package team

import (
	"context"
	"reflect"
	
	team_dto "github.com/APIParkLab/APIPark/module/team/dto"
	"github.com/eolinker/go-common/autowire"
)

type ITeamModule interface {
	// GetTeam 获取团队信息
	GetTeam(ctx context.Context, id string) (*team_dto.Team, error)
	// Search 搜索团队
	Search(ctx context.Context, keyword string) ([]*team_dto.Item, error)
	
	// Create 创建团队
	Create(ctx context.Context, input *team_dto.CreateTeam) (*team_dto.Team, error)
	// Edit 编辑团队
	Edit(ctx context.Context, id string, input *team_dto.EditTeam) (*team_dto.Team, error)
	// Delete 删除团队
	Delete(ctx context.Context, id string) error
}

func init() {
	autowire.Auto[ITeamModule](func() reflect.Value {
		return reflect.ValueOf(new(imlTeamModule))
	})
}
