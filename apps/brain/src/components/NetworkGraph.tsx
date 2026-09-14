'use client';

import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { Network } from 'vis-network';
// @ts-ignore
import { DataSet } from 'vis-data';
import { Loader, Box } from '@mantine/core';
import { ExtendedNode, ExtendedEdge } from '../types';

interface NetworkGraphProps {
  nodes: ExtendedNode[];
  edges: ExtendedEdge[];
  onNodeClick?: (node: ExtendedNode) => void;
  onEdgeClick?: (edge: ExtendedEdge) => void;
  onNetworkReady?: (network: Network) => void;
}

const PHYSICS_OPTIONS = {
  enabled: true,
  solver: 'forceAtlas2Based',
  forceAtlas2Based: {
    gravitationalConstant: -50, // Standar
    centralGravity: 0.05, // Diperkuat (sebelumnya 0.015) agar klaster terpisah tidak terbang
    springLength: 100, // Diperpendek agar graf lebih padat dan visual berubah signifikan
    springConstant: 0.08,
    damping: 0.4,
    avoidOverlap: 0.5,
  },
  stabilization: {
    enabled: true,
    iterations: 500,
    updateInterval: 20,
    fit: true,
  },
  minVelocity: 0.5,
};

export default function NetworkGraph({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
  onNetworkReady,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodeDataSetRef = useRef<DataSet<ExtendedNode> | null>(null);
  const edgeDataSetRef = useRef<DataSet<ExtendedEdge> | null>(null);
  const stabilizationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Selalu simpan versi callback terbaru di ref ──────────────────────────
  // Ini mencegah stale closure: vis-network event listener di-setup sekali
  // tapi tetap bisa memanggil handleEdgeClick / handleNodeClick versi terbaru.
  const onNodeClickRef = useRef(onNodeClick);
  const onEdgeClickRef = useRef(onEdgeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);
  useEffect(() => {
    onEdgeClickRef.current = onEdgeClick;
  }, [onEdgeClick]);

  const [isLoading, setIsLoading] = useState(true);

  // ── Inisialisasi Network sekali (tanpa data) ────────────────────────────────
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
          margin: { top: 10, bottom: 10 },
        },
        edges: {
          font: { size: 0 },
          width: 1,
          color: { opacity: 0.5 },
          hoverWidth: 4, // lebih tebal saat hover → area klik lebih besar
          selectionWidth: 5, // lebih tebal saat selected → feedback visual
          arrows: { to: { enabled: true, scaleFactor: 0.8 } },
          smooth: {
            enabled: true,
            type: 'dynamic',
            roundness: 0.5,
          },
        },
        interaction: {
          hover: true,
          navigationButtons: false,
          dragNodes: true, // node bisa di-drag / dipindah-pindah
          dragView: true,
          zoomView: true,
          multiselect: false,
          selectConnectedEdges: false,
          tooltipDelay: 300,
        },
        physics: PHYSICS_OPTIONS,
        layout: {
          improvedLayout: true,
          hierarchical: { enabled: false },
        },
      }
    );

    // ── Node click & Canvas click (Focus Dimming Logic) ──────────────────────
    networkRef.current.on('click', (params) => {
      if (
        !nodeDataSetRef.current ||
        !edgeDataSetRef.current ||
        !networkRef.current
      )
        return;

      if (params.nodes.length > 0) {
        // Klik pada node
        const selectedNodeId = params.nodes[0];

        // Dapatkan semua node dan edge yang terhubung
        const connectedNodes = networkRef.current.getConnectedNodes(
          selectedNodeId
        ) as (string | number)[];
        const connectedEdges = networkRef.current.getConnectedEdges(
          selectedNodeId
        ) as (string | number)[];

        const allNodes = nodeDataSetRef.current.get();
        const allEdges = edgeDataSetRef.current.get();

        // Update nodes: redupkan yang tidak terkait
        const updatedNodes = allNodes.map((node) => {
          const isConnected =
            node.id === selectedNodeId ||
            connectedNodes.includes(node.id as string | number);
          return {
            id: node.id,
            opacity: isConnected ? 1 : 0.15,
          };
        });

        // Update edges: redupkan yang tidak terkait tanpa menghilangkan warna asli
        const updatedEdges = allEdges.map((edge) => {
          const originalEdge = edges.find((e) => e.id === edge.id);
          const isConnected = connectedEdges.includes(
            edge.id as string | number
          );

          let baseColor = 'gray';
          if (originalEdge?.color) {
            if (typeof originalEdge.color === 'string') {
              baseColor = originalEdge.color;
            } else if (
              typeof originalEdge.color === 'object' &&
              originalEdge.color.color
            ) {
              baseColor = originalEdge.color.color;
            }
          }

          return {
            id: edge.id,
            color: isConnected
              ? { color: baseColor, opacity: 1, inherit: false }
              : {
                  color: 'rgba(150, 150, 150, 0.1)',
                  opacity: 0.05,
                  inherit: false,
                },
          };
        });

        nodeDataSetRef.current.update(updatedNodes);
        edgeDataSetRef.current.update(updatedEdges);

        const node = nodeDataSetRef.current.get(selectedNodeId) as ExtendedNode;
        if (node) onNodeClickRef.current?.(node);
      } else if (params.edges.length === 0) {
        // Klik area kosong: kembalikan opacity ke normal
        const allNodes = nodeDataSetRef.current.get();

        const updatedNodes = allNodes.map((node) => ({
          id: node.id,
          opacity: 1,
        }));

        // Reset edge completely to original prop definitions
        const updatedEdges = edges.map((edge) => ({
          id: edge.id,
          color: edge.color,
        }));

        nodeDataSetRef.current.update(updatedNodes);
        edgeDataSetRef.current.update(updatedEdges);
      }
    });

    // ── Edge click — gunakan 'selectEdge' (jauh lebih reliabel dari 'click') ──
    // Event 'selectEdge' HANYA fires saat edge benar-benar diklik/selected,
    // tidak campur aduk dengan node click.
    networkRef.current.on('selectEdge', (params) => {
      if (params.edges.length > 0 && edgeDataSetRef.current) {
        const edge = edgeDataSetRef.current.get(
          params.edges[0]
        ) as ExtendedEdge;
        if (edge) onEdgeClickRef.current?.(edge);
      }
    });

    // ── Cegah dragView saat klik node/edge ───────────────────────────────────
    networkRef.current.on('dragStart', (params) => {
      if (params.edges.length > 0 || params.nodes.length > 0) {
        networkRef.current?.setOptions({ interaction: { dragView: false } });
      }
    });
    networkRef.current.on('dragEnd', () => {
      networkRef.current?.setOptions({ interaction: { dragView: true } });
    });

    // ── Selesai stabilisasi → matikan animasi awal ────────────────────────────────
    networkRef.current.on('stabilizationIterationsDone', () => {
      if (stabilizationTimeoutRef.current)
        clearTimeout(stabilizationTimeoutRef.current);
      networkRef.current?.setOptions({ physics: { enabled: false } });
      setIsLoading(false);
      networkRef.current?.fit({
        animation: { duration: 600, easingFunction: 'easeInOutQuad' },
      });
      onNetworkReady?.(networkRef.current!);
    });

    // ── Fallback: paksa selesai jika stabilisasi terlalu lama ───────────────
    stabilizationTimeoutRef.current = setTimeout(() => {
      if (networkRef.current) {
        setIsLoading(false);
        networkRef.current.fit({ animation: false });
        onNetworkReady?.(networkRef.current);
      }
    }, 5000);

    return () => {
      if (stabilizationTimeoutRef.current)
        clearTimeout(stabilizationTimeoutRef.current);
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  // ── Update data ketika nodes/edges berubah ───────────────────────────────
  useEffect(() => {
    if (!networkRef.current) return;

    if (nodes.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Hard reset dataset untuk memaksa vis-network membuang cache posisi koordinat (x,y)
    nodeDataSetRef.current = new DataSet<ExtendedNode>(nodes);
    edgeDataSetRef.current = new DataSet<ExtendedEdge>(edges);

    networkRef.current.setData({
      nodes: nodeDataSetRef.current,
      edges: edgeDataSetRef.current,
    });

    // Terapkan ulang opsi fisika secara eksplisit
    networkRef.current.setOptions({ physics: PHYSICS_OPTIONS });
    networkRef.current.stabilize(400);

    if (stabilizationTimeoutRef.current)
      clearTimeout(stabilizationTimeoutRef.current);
    stabilizationTimeoutRef.current = setTimeout(() => {
      if (networkRef.current) {
        networkRef.current.setOptions({ physics: { enabled: false } });
        setIsLoading(false);
        networkRef.current.fit({
          animation: { duration: 600, easingFunction: 'easeInOutQuad' },
        });
        onNetworkReady?.(networkRef.current);
      }
    }, 4000);
  }, [nodes, edges, onNetworkReady]);

  return (
    <Box style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isLoading && (
        <Loader
          size="xl"
          type="dots"
          color="blue"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        />
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', border: '1px solid black' }}
      />
    </Box>
  );
}
