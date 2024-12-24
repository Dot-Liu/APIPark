'use client'

import { useFetch } from '@common/hooks/http'
import {
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  PanOnScrollMode,
  ReactFlow,
  useEdgesState,
  useNodesState
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useState } from 'react'
import { KeyStatusNode } from './components/KeyStatusNode'
import { ModelCardNode } from './components/ModelCardNode'
import { ServiceCardNode } from './components/NodeComponents'
import { ModelData } from './components/types'
import { LAYOUT } from './constants'
import './styles.css'

interface ApiResponse {
  data: {
    backup: {
      id: string
      name: string
    }
    providers: ModelData[]
  }
  code: number
  success: string
}

interface NodeData {
  title?: string
  status?: string
  defaultModel?: string
  logo?: string
  keys?: Array<{
    id: string
    status: string
    priority: number
  }>
}

const calculateNodePositions = (models: ModelData[], startY = LAYOUT.NODE_START_Y, gap = LAYOUT.NODE_GAP) => {
  return models.reduce(
    (acc, model, index) => {
      acc[model.id] = {
        x: LAYOUT.MODEL_NODE_X,
        y: startY + index * gap
      }
      acc[`${model.id}-keys`] = {
        x: LAYOUT.KEY_NODE_X,
        y: startY + index * gap
      }
      return acc
    },
    {} as Record<string, { x: number; y: number }>
  )
}

const nodeTypes: NodeTypes = {
  modelCard: ModelCardNode,
  keyCard: KeyStatusNode,
  serviceCard: ServiceCardNode
} as const

const AIFlowChart = () => {
  const [modelData, setModelData] = useState<ModelData[]>([])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fetchData } = useFetch()

  useEffect(() => {
    // Mock API call - replace with actual API call
    fetchData<ApiResponse>('ai/providers/configured', {
      method: 'GET',
      eoApiPrefix: 'http://uat.apikit.com:11204/mockApi/aoplatform/api/v1/'
    }).then((response) => {
      const mockApiResponse: ApiResponse = response as ApiResponse
      setModelData(mockApiResponse.data.providers)
    })
  }, [])

  useEffect(() => {
    if (!modelData.length) return

    const newNodes = [
      {
        id: 'apiService',
        type: 'serviceCard',
        position: { x: LAYOUT.SERVICE_NODE_X, y: LAYOUT.NODE_START_Y },
        data: {}
      },
      ...modelData.map((model) => ({
        id: model.id,
        type: 'modelCard',
        position: calculateNodePositions(modelData)[model.id],
        data: {
          title: model.name,
          status: model.status,
          defaultModel: model.default_llm,
          logo: model.logo
        }
      })),
      ...modelData.map((model) => ({
        id: `${model.id}-keys`,
        type: 'keyCard',
        position: calculateNodePositions(modelData)[`${model.id}-keys`],
        data: {
          title: 'API Keys',
          keys: model.keys.map((key, index) => ({
            id: key.id,
            status: key.status,
            priority: index + 1
          }))
        }
      }))
    ]

    const newEdges: any = [
      ...modelData.map((model) => ({
        id: `service-${model.id}`,
        source: 'apiService',
        target: model.id,
        label: `apis(${model.api_count})`,
        style: { stroke: '#ddd', cursor: 'pointer' },
        type: 'smoothstep',
        markerEnd: { type: 'arrow' }
      })),
      ...modelData.map((model) => ({
        id: `${model.id}-keys`,
        source: model.id,
        type: 'smoothstep',
        target: `${model.id}-keys`,
        animated: true,
        style: { stroke: '#ddd' }
      }))
    ]

    setNodes(newNodes)
    setEdges(newEdges)
  }, [modelData])

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges])

  const onNodeDrag: any = useCallback(
    (_: MouseEvent, node: Node<any>) => {
      if (node.type !== 'modelCard') return

      setNodes((nds) => {
        return nds.map((n) => {
          if (n.type === 'keyCard' && n.id === `${node.id}-keys`) {
            return {
              ...n,
              position: {
                x: LAYOUT.KEY_NODE_X,
                y: node.position.y
              }
            }
          }
          return n
        })
      })
    },
    [setNodes]
  )

  const onNodeDragStop: any = useCallback(
    (_, node: Node<any>) => {
      if (node.type !== 'modelCard') return

      setNodes((nds) => {
        const modelNodes = nds.filter((n) => n.type === 'modelCard')
        const sortedNodes = [...modelNodes].sort((a, b) => a.position.y - b.position.y)

        return nds.map((n) => {
          if (n.type === 'modelCard') {
            const index = sortedNodes.findIndex((sn) => sn.id === n.id)
            return {
              ...n,
              position: {
                x: LAYOUT.MODEL_NODE_X,
                y: LAYOUT.NODE_START_Y + index * LAYOUT.NODE_GAP
              }
            }
          }
          if (n.type === 'keyCard') {
            const modelId = n.id.replace('-keys', '')
            const modelNode = sortedNodes.find((mn) => mn.id === modelId)
            if (modelNode) {
              const index = sortedNodes.findIndex((sn) => sn.id === modelId)
              return {
                ...n,
                position: {
                  x: LAYOUT.KEY_NODE_X,
                  y: LAYOUT.NODE_START_Y + index * LAYOUT.NODE_GAP
                }
              }
            }
          }
          return n
        })
      })
    },
    [setNodes]
  )

  return (
    <div className="overflow-y-auto w-full h-full" style={{ height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        maxZoom={1}
        minZoom={1}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Vertical}
      />
    </div>
  )
}

export default AIFlowChart
