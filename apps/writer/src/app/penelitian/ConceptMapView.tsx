"use client";

import * as React from "react";
import { ActionIcon, Badge, Box, Group, Paper, Text, Tooltip } from "@mantine/core";
import { IconMaximize, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import type { ConceptMapData, ConceptMapNode } from "@/lib/conceptMap";
import "vis-network/styles/vis-network.css";

/**
 * Read-only peta konsep for the penelitian page: same layout and colours as the
 * editor's ConceptMap, but no editing — click a node to read its full text.
 */
export function ConceptMapView({ data, dark }: { data: ConceptMapData; dark: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const network = React.useRef<import("vis-network").Network | null>(null);
  const [selected, setSelected] = React.useState<ConceptMapNode | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Network } = await import("vis-network");
      if (cancelled || !ref.current) return;
      network.current?.destroy();
      const net = new Network(
        ref.current,
        // vis mutates what it gets; hand it copies.
        // `font.bold: true` is what the editor passes too (vis types want a string).
        { nodes: data.nodes.map((n) => ({ ...n })) as never, edges: data.edges.map((e) => ({ ...e })) },
        {
          layout: {
            hierarchical: { enabled: true, direction: "UD", sortMethod: "directed", levelSeparation: 150, nodeSpacing: 200 },
          },
          physics: false,
          edges: {
            arrows: { to: { enabled: true, scaleFactor: 0.7 } },
            color: { color: dark ? "#868e96" : "#adb5bd", highlight: "#228be6" },
            smooth: { enabled: true, type: "cubicBezier", forceDirection: "vertical", roundness: 0.15 },
          },
          nodes: {
            font: { color: "#212529" },
            shadow: { enabled: true, color: "rgba(0,0,0,0.2)", size: 5, x: 2, y: 2 },
          },
          interaction: { hover: true, tooltipDelay: 200, dragNodes: true, dragView: true, zoomView: true },
        },
      );
      net.on("click", (event: { nodes: string[] }) => {
        const id = event.nodes[0];
        setSelected(id ? data.nodes.find((n) => n.id === id) ?? null : null);
      });
      network.current = net;
    })();
    return () => {
      cancelled = true;
      network.current?.destroy();
      network.current = null;
    };
  }, [data, dark]);

  const zoom = (factor: number) => {
    const net = network.current;
    if (net) net.moveTo({ scale: net.getScale() * factor, animation: { duration: 200, easingFunction: "easeInOutQuad" } });
  };

  return (
    <Box>
      <Box pos="relative">
        <div ref={ref} className="adm-conceptmap" />
        <Group gap={4} pos="absolute" bottom={8} right={8}>
          <Tooltip label="Perbesar">
            <ActionIcon variant="default" onClick={() => zoom(1.25)} aria-label="Perbesar">
              <IconZoomIn size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Perkecil">
            <ActionIcon variant="default" onClick={() => zoom(0.8)} aria-label="Perkecil">
              <IconZoomOut size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Tampilkan semua">
            <ActionIcon variant="default" onClick={() => network.current?.fit({ animation: true })} aria-label="Tampilkan semua">
              <IconMaximize size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>
      <Paper withBorder radius="md" p="sm" mt="sm">
        {selected ? (
          <>
            <Badge
              size="xs"
              variant="light"
              color={selected.type === "H1" ? "green" : selected.type === "Paragraph" ? "gray" : "yellow"}
              mb={6}
            >
              {selected.type === "Paragraph" ? "Paragraf" : selected.type}
            </Badge>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {selected.title}
            </Text>
          </>
        ) : (
          <Text size="xs" c="dimmed">
            Klik salah satu node untuk membaca teks lengkapnya. Hijau = judul (H1), kuning = subjudul (H2–H4), abu-abu = paragraf.
          </Text>
        )}
      </Paper>
    </Box>
  );
}
