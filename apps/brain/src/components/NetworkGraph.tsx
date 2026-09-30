'use client';

import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { Loader, Box, Group, Button, Stack, ActionIcon, Badge, Paper } from '@mantine/core';
import { ExtendedNode, ExtendedEdge } from '../types';
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconZoomIn,
  IconZoomOut,
  IconMaximize,
  IconCircleDot,
  IconConnection,
  IconListDetails,
  IconLayoutSidebarRight,
} from '@tabler/icons-react';
import GraphLegend from './GraphLegend';

interface NetworkGraphProps {
  nodes: ExtendedNode[];
  edges: ExtendedEdge[];
  onNodeClick?: (node: ExtendedNode) => void;
  onEdgeClick?: (edge: ExtendedEdge) => void;
}

export default function NetworkGraph({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodeDataSetRef = useRef<DataSet<ExtendedNode> | null>(null);
  const edgeDataSetRef = useRef<DataSet<ExtendedEdge> | null>(null);

  const [ isLoading, setIsLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showPanControls, setShowPanControls] = useState(true);

  const handleMove = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!networkRef.current) return;
    
    const currentView = networkRef.current.getViewPosition();
    const moveStep = 100; // Pixels to move
    
    const movements = {
      up: { x: 0, y: -moveStep },
      down: { x: 0, y: moveStep },
      left: { x: -moveStep, y: 0 },
      right: { x: moveStep, y: 0 }
    };

    networkRef.current.moveTo({
      position: {
        x: currentView.x + movements[direction].x,
        y: currentView.y + movements[direction].y
      },
      animation: true
    });
  }

  const handleZoomIn = (type: 'in' | 'out') => {
    if (!networkRef.current) return;
    
    const currentScale = networkRef.current.getScale();
    const zoomStep = 0.2;
    
    const newScale = type === 'in' 
      ? currentScale * (1 + zoomStep)
      : currentScale * (1 - zoomStep);
    
    networkRef.current.moveTo({
      scale: newScale,
      animation: true
    });
  };

  const handleFitView = () => {
    if (!networkRef.current) return;
    networkRef.current.fit({
      animation: true
    });
  };
  
  useEffect(() => {
    if (!containerRef.current) return;

    nodeDataSetRef.current = new DataSet<ExtendedNode>();
    edgeDataSetRef.current = new DataSet<ExtendedEdge>();

    networkRef.current = new Network(
      containerRef.current,
      {
        nodes: nodeDataSetRef.current,
        edges: edgeDataSetRef.current,
      },
      {
        nodes: {
          shape: 'circle',
          margin: {
            top: 10,
            bottom: 10,
          },
        },
        edges: {
          font: { size: 0 },
          width: 3,
          smooth: {
            enabled: true,
            type: 'dynamic',
            forceDirection: true,
            roundness: 0.5,
          },
        },
        interaction: { 
          hover: true, 
          navigationButtons: false,
          dragNodes: true,
          dragView: true,
          zoomView: true,
          multiselect: true,
        },
        physics: { 
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
              gravitationalConstant: -50,
              centralGravity: 0.05,
              springLength: 100,
              springConstant: 0.08,
              damping: 0.4,
              avoidOverlap: 1,
          },
          stabilization: {
              enabled: true,
              iterations: 1000,
              updateInterval: 50,
              onlyDynamicEdges: false,
              fit: true,
          },
        },
        layout: {
          improvedLayout: true,
        },
      },
    );

    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0 && nodeDataSetRef.current) {
        const node = nodeDataSetRef.current.get(params.nodes[0]) as ExtendedNode;
        if (node) onNodeClick?.(node);
      } else if (params.edges.length > 0 && edgeDataSetRef.current) {
        const edge = edgeDataSetRef.current.get(params.edges[0]) as ExtendedEdge;
        if (edge) onEdgeClick?.(edge);
      }
    });

    networkRef.current.once('stabilizationIterationsDone', () => {
        setIsLoading(false);
        if (networkRef.current) {
          networkRef.current.setOptions({ physics: false});
          networkRef.current.fit({ animation: true});
        }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!nodeDataSetRef.current || !edgeDataSetRef.current || !networkRef.current) return;

    setIsLoading(true);
    
    // Update nodes
    nodeDataSetRef.current.clear();
    nodeDataSetRef.current.add(nodes);
    
    // Update edges
    edgeDataSetRef.current.clear();
    edgeDataSetRef.current.add(edges);

    // Re-enable physics temporarily for layout adjustment
    networkRef.current.setOptions({ physics: { enabled: true } });
    
    // Disable physics after stabilization
    const stabilizationHandler = () => {
      setIsLoading(false);
      if (networkRef.current) {
        networkRef.current.setOptions({ physics: false });
        networkRef.current.fit({ animation: true });
      }
    };

    networkRef.current.once('stabilizationIterationsDone', stabilizationHandler);
    
    // Fallback timeout in case stabilization doesn't trigger
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      if (networkRef.current) {
        networkRef.current.setOptions({ physics: false });
        networkRef.current.off('stabilizationIterationsDone', stabilizationHandler);
      }
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      if (networkRef.current) {
        networkRef.current.off('stabilizationIterationsDone', stabilizationHandler);
      }
    };
  }, [nodes, edges]);

  return (
    <Box style={{ position: 'relative', width: '100%', height: '400px' }}>
      { isLoading && (
        <Loader
          size="xl"
          variant="dots"
          color="blue"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}
        />
      )}

      {/* Node / Edge count badges */}
      <Group
        gap="xs"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1,
        }}
      >
        <Badge
          variant="light"
          color="blue"
          size="lg"
          radius="sm"
          leftSection={<IconCircleDot size={12} />}
        >
          {nodes.length} NODE
        </Badge>
        <Badge
          variant="light"
          color="grape"
          size="lg"
          radius="sm"
          leftSection={<IconConnection size={12} />}
        >
          {edges.length} EDGE
        </Badge>
        <ActionIcon
          variant="light"
          color={showPanControls ? 'blue' : 'gray'}
          size="lg"
          radius="sm"
          onClick={() => setShowPanControls((v) => !v)}
          title="Tampilkan/sembunyikan kontrol navigasi"
        >
          <IconListDetails size={16} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          color={showLegend ? 'blue' : 'gray'}
          size="lg"
          radius="sm"
          onClick={() => setShowLegend((v) => !v)}
          title="Tampilkan/sembunyikan legenda"
        >
          <IconLayoutSidebarRight size={16} />
        </ActionIcon>
      </Group>

      {/* Navigation Controls (pan) */}
      {showPanControls && (
      <Group
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          zIndex: 1
        }}
        gap="xs"
      >
        <Stack gap="xs" align="center">
          <Button
            size="sm"
            variant="light"
            onClick={() => handleMove('up')}
          >
            <IconArrowUp size={16} />
          </Button>

          <Group gap="xs">
            <Button
              size="sm"
              variant="light"
              onClick={() => handleMove('left')}
            >
              <IconArrowLeft size={16} />
            </Button>
            <Button
              size="sm"
              variant="light"
              onClick={() => handleMove('down')}
            >
              <IconArrowDown size={16} />
            </Button>
            <Button
              size="sm"
              variant="light"
              onClick={() => handleMove('right')}
            >
              <IconArrowRight size={16} />
            </Button>
          </Group>
        </Stack>
      </Group>
      )}

      {/* Right side vertical zoom/fit stack */}
      <Paper
        shadow="sm"
        radius="xl"
        withBorder
        p={4}
        style={{
          position: 'absolute',
          right: 12,
          top: 56,
          zIndex: 1,
          backgroundColor: 'rgba(255,255,255,0.95)',
        }}
      >
        <Stack gap={4}>
          <ActionIcon
            size="lg"
            radius="xl"
            variant="light"
            onClick={() => handleZoomIn('in')}
            title="Perbesar"
          >
            <IconZoomIn size={18} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            radius="xl"
            variant="light"
            onClick={() => handleZoomIn('out')}
            title="Perkecil"
          >
            <IconZoomOut size={18} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            radius="xl"
            variant="light"
            color="blue"
            onClick={handleFitView}
            title="Sesuaikan ke layar"
          >
            <IconMaximize size={18} />
          </ActionIcon>
        </Stack>
      </Paper>

      {showLegend && <GraphLegend />}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 8,
        }}
      />
    </Box>
  )
}
