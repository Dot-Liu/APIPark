package system_apikey

import (
	"context"
	"encoding/json"
	"time"

	application_authorization "github.com/APIParkLab/APIPark/service/application-authorization"

	"github.com/APIParkLab/APIPark/service/service"

	"github.com/APIParkLab/APIPark/service/cluster"

	team_member "github.com/APIParkLab/APIPark/service/team-member"

	"github.com/eolinker/go-common/store"

	"github.com/APIParkLab/APIPark/gateway"

	"github.com/eolinker/go-common/utils"

	"github.com/google/uuid"

	system_apikey "github.com/APIParkLab/APIPark/service/system-apikey"

	system_apikey_dto "github.com/APIParkLab/APIPark/module/system-apikey/dto"
)

var _ IAPIKeyModule = new(imlAPIKeyModule)

type imlAPIKeyModule struct {
	apikeyService                   system_apikey.IAPIKeyService                    `autowired:""`
	clusterServer                   cluster.IClusterService                         `autowired:""`
	teamMemberService               team_member.ITeamMemberService                  `autowired:""`
	serviceService                  service.IServiceService                         `autowired:""`
	applicationAuthorizationService application_authorization.IAuthorizationService `autowired:""`
	transaction                     store.ITransaction                              `autowired:""`
}

func (i *imlAPIKeyModule) MyAPIKeys(ctx context.Context) ([]*system_apikey_dto.SimpleItem, error) {
	members, err := i.teamMemberService.Members(ctx, nil, nil)
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	teamIds := utils.SliceToSlice(members, func(m *team_member.Member) string {
		return m.Come
	})
	apps, err := i.serviceService.AppListByTeam(ctx, teamIds...)
	if err != nil {
		return nil, err
	}
	appIds := utils.SliceToSlice(apps, func(a *service.Service) string {
		return a.Id
	})
	auths, err := i.applicationAuthorizationService.ListByApp(ctx, appIds...)
	if err != nil {
		return nil, err
	}
	result := make([]*system_apikey_dto.SimpleItem, 0, len(auths))
	for _, a := range auths {
		if a.Type != "apikey" {
			continue
		}
		m := make(map[string]string)
		json.Unmarshal([]byte(a.Config), &m)
		if m["apikey"] == "" {
			continue
		}
		result = append(result, &system_apikey_dto.SimpleItem{
			Id:      a.UUID,
			Name:    a.Name,
			Value:   m["apikey"],
			Expired: a.ExpireTime,
		})

	}
	return result, nil

}

func (i *imlAPIKeyModule) Create(ctx context.Context, input *system_apikey_dto.Create) error {
	if input.Id == "" {
		input.Id = uuid.NewString()
	}
	return i.transaction.Transaction(ctx, func(ctx context.Context) error {
		err := i.apikeyService.Create(ctx, &system_apikey.Create{
			Id:      input.Id,
			Name:    input.Name,
			Value:   input.Value,
			Expired: input.Expired,
		})
		if err != nil {
			return err
		}
		client, err := i.clusterServer.GatewayClient(ctx, cluster.DefaultClusterID)
		if err != nil {
			return err
		}
		return i.online(ctx, client)
	})
}

func (i *imlAPIKeyModule) Update(ctx context.Context, id string, input *system_apikey_dto.Update) error {
	return i.transaction.Transaction(ctx, func(ctx context.Context) error {
		err := i.apikeyService.Save(ctx, id, &system_apikey.Update{
			Name:    input.Name,
			Value:   input.Value,
			Expired: input.Expired,
		})
		if err != nil {
			return err
		}
		client, err := i.clusterServer.GatewayClient(ctx, cluster.DefaultClusterID)
		if err != nil {
			return err
		}
		return i.online(ctx, client)
	})
}

func (i *imlAPIKeyModule) Delete(ctx context.Context, id string) error {
	return i.transaction.Transaction(ctx, func(ctx context.Context) error {
		err := i.apikeyService.Delete(ctx, id)
		if err != nil {
			return err
		}
		client, err := i.clusterServer.GatewayClient(ctx, cluster.DefaultClusterID)
		if err != nil {
			return err
		}
		return i.online(ctx, client)
	})
}

func (i *imlAPIKeyModule) Get(ctx context.Context, id string) (*system_apikey_dto.APIKey, error) {
	info, err := i.apikeyService.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	return system_apikey_dto.ToAPIKey(info), nil
}

func (i *imlAPIKeyModule) Search(ctx context.Context, keyword string) ([]*system_apikey_dto.Item, error) {
	list, err := i.apikeyService.Search(ctx, keyword, nil, "create_at desc")
	if err != nil {
		return nil, err
	}

	return utils.SliceToSlice(list, system_apikey_dto.ToAPIKeyItem), nil
}

func (i *imlAPIKeyModule) SimpleList(ctx context.Context) ([]*system_apikey_dto.SimpleItem, error) {
	list, err := i.apikeyService.Search(ctx, "", nil, "create_at desc")
	if err != nil {
		return nil, err
	}

	return utils.SliceToSlice(list, system_apikey_dto.ToAPIKeySimpleItem), nil
}

func (i *imlAPIKeyModule) online(ctx context.Context, client gateway.IClientDriver) error {

	// 获取所有apikey
	list, err := i.apikeyService.Search(ctx, "", nil, "create_at desc")
	if err != nil {
		return err
	}
	app := &gateway.ApplicationRelease{
		BasicItem: &gateway.BasicItem{
			ID:          "apipark-global",
			Description: "apipark global consumer",
			Version:     time.Now().Format("20060102150405"),
		},
		Authorizations: utils.SliceToSlice(list, func(a *system_apikey.APIKey) *gateway.Authorization {
			authCfg := map[string]interface{}{
				"apikey": utils.Md5(a.Value),
			}
			return &gateway.Authorization{
				Type:           "apikey",
				Position:       "header",
				TokenName:      "Authorization",
				Expire:         a.Expired,
				Config:         authCfg,
				HideCredential: true,
				Label: map[string]string{
					"authorization":      a.Id,
					"authorization_name": a.Name,
				},
			}
		}),
	}
	err = client.Application().Online(ctx, app)
	if err != nil {
		return err
	}
	return nil
}

func (i *imlAPIKeyModule) initGateway(ctx context.Context, clusterId string, clientDriver gateway.IClientDriver) error {
	return i.online(ctx, clientDriver)
}
