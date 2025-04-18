import { App, Button } from 'antd'
import { $t } from '@common/locales/index.ts'
import { useFetch } from '@common/hooks/http.ts'
import { BasicResponse, RESPONSE_TIPS, STATUS_CODE } from '@common/const/const'

export const LogsFooter = (props: any) => {
  const { record, closeModal = () => {} } = props
  const { message, modal } = App.useApp()
  const { fetchData } = useFetch()
  const stopDeploy = () => {
    modal.confirm({
      title: $t('停止部署'),
      content: $t('确定停止部署吗?'),
      onOk: () => {
        return new Promise((resolve, reject) => {
          fetchData<BasicResponse<any>>('model/local/cancel_deploy', {
            method: 'POST',
            eoBody: { model: record.id }
          })
            .then((response) => {
              const { code, msg } = response
              if (code === STATUS_CODE.SUCCESS) {
                setTimeout(() => {
                  resolve(true)
                  closeModal()
                }, 500)
              } else {
                message.error(msg || $t(RESPONSE_TIPS.error))
                reject(false)
              }
            })
        })
      },
      width: 600,
      okText: $t('确认'),
      cancelText: $t('取消'),
      closable: true,
      icon: <></>
    })
  }
  const deleteService = () => {
    modal.confirm({
      title: $t('删除服务'),
      content: $t('确定删除服务吗?'),
      onOk: () => {
        return new Promise((resolve, reject) => {
          fetchData<BasicResponse<any>>('model/local', {
            method: 'DELETE',
            eoParams: { model: record.id }
          })
            .then((response: BasicResponse<any>) => {
              const { code, msg } = response
              if (code === STATUS_CODE.SUCCESS) {
                setTimeout(() => {
                  resolve(true)
                  closeModal()
                }, 500)
              } else {
                message.error(msg || $t(RESPONSE_TIPS.error))
                reject(false)
              }
            })
        })
      },
      width: 600,
      okText: $t('确认'),
      cancelText: $t('取消'),
      closable: true,
      icon: <></>
    })
  }
  return (
    <>
      {['deploying_error', 'error'].includes(record.state) ? (
        <div className="flex justify-end items-center">
          <Button onClick={() => { closeModal(true) }}>{$t('取消')}</Button>
          <Button onClick={deleteService} type="primary" danger>
            {$t('删除服务')}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end items-center">
          <Button onClick={stopDeploy} type="primary" danger>
            {$t('停止')}
          </Button>
          <Button type="primary" onClick={() => { closeModal() }}>{$t('继续等待')}</Button>
        </div>
      )}
    </>
  )
}
