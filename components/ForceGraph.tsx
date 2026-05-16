import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge, NodeStatus, UserProgress } from '../types';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  progress: UserProgress;
  onNodeClick: (node: GraphNode) => void;
  width: number;
  height: number;
}

const getNodeColor = (status: NodeStatus) => {
  switch (status) {
    case NodeStatus.MASTERED: return '#22c55e'; // Green-500
    case NodeStatus.AVAILABLE: return '#3b82f6'; // Blue-500
    case NodeStatus.LEARNING: return '#a855f7'; // Purple-500
    case NodeStatus.REMEDIATION: return '#f59e0b'; // Amber-500
    case NodeStatus.LOCKED: default: return '#94a3b8'; // Slate-400
  }
};

const ForceGraph: React.FC<ForceGraphProps> = ({ nodes, edges, progress, onNodeClick, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const containerRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // --- Data Cloning ---
    const simulationNodes = nodes.map(n => ({ ...n }));
    const simulationEdges = edges.map(e => ({
      ...e,
      source: typeof e.source === 'object' ? (e.source as any).id : e.source,
      target: typeof e.target === 'object' ? (e.target as any).id : e.target
    }));

    // Select SVG
    const svg = d3.select(svgRef.current);
    
    // Clear previous
    svg.selectAll("*").remove();

    // Create a container group for zooming
    const container = svg.append("g");
    containerRef.current = container.node();

    // --- Simulation Setup ---
    // With ~40 nodes, we need optimized forces to prevent overlapping but keep them compact
    const simulation = d3.forceSimulation(simulationNodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(simulationEdges).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-250)) // Reduce repulsion slightly for more nodes
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(35).iterations(2));

    // Define Arrow Marker
    svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25) 
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#cbd5e1");

    // Draw Edges
    const link = container.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(simulationEdges)
      .join("line")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Draw Nodes Group
    const node = container.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .selectAll("g")
      .data(simulationNodes)
      .join("g")
      .style("cursor", (d: any) => {
        const status = progress[d.id]?.status || NodeStatus.LOCKED;
        if (Object.keys(progress).length === 0) return "move"; 
        return status === NodeStatus.LOCKED ? "not-allowed" : "pointer";
      })
      .call(drag(simulation) as any)
      .on("click", (event, d: any) => {
        const status = progress[d.id]?.status || NodeStatus.LOCKED;
        if (Object.keys(progress).length === 0 || status !== NodeStatus.LOCKED) {
           onNodeClick(d as GraphNode);
        }
      });

    // Node Circles
    node.append("circle")
      .attr("r", 20)
      .attr("fill", (d: any) => {
        const status = progress[d.id]?.status || NodeStatus.LOCKED;
        if (Object.keys(progress).length === 0) return '#3b82f6';
        return getNodeColor(status);
      });

    // Node Labels (with background for readability)
    node.append("text")
      .text((d: any) => d.label)
      .attr("x", 25)
      .attr("y", 5)
      .attr("fill", "#334155")
      .attr("stroke", "white") // Text halo
      .attr("stroke-width", 3)
      .attr("paint-order", "stroke")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    // --- Zoom Behavior ---
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4]) // Allow zooming out to 0.1x and in to 4x
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });
    
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // --- Simulation Tick with Bounding ---
    const nodeRadius = 20;
    
    simulation.on("tick", () => {
      // Optional: Constraint nodes to be somewhat within bounds to prevent flying off too far
      // Note: With Zoom enabled, we don't strictly need this, but it keeps the initial layout nice.
      // We apply a soft constraint by clamping.
      
      simulationNodes.forEach((d: any) => {
         // Clamp to roughly 2x the view size to allow some spread but prevent infinity
         d.x = Math.max(-width, Math.min(width * 2, d.x));
         d.y = Math.max(-height, Math.min(height * 2, d.y));
      });

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, progress, width, height, onNodeClick]);

  // --- Helpers ---

  // Drag behavior for nodes
  function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  // Zoom Controls
  const handleZoomIn = () => {
      if(svgRef.current && zoomRef.current) {
          d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.2);
      }
  };
  const handleZoomOut = () => {
      if(svgRef.current && zoomRef.current) {
          d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.8);
      }
  };
  const handleResetView = () => {
      if(svgRef.current && zoomRef.current) {
          d3.select(svgRef.current).transition().duration(750).call(
              zoomRef.current.transform, 
              d3.zoomIdentity
          );
      }
  };

  return (
    <div className="w-full h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner relative group">
       <svg ref={svgRef} className="w-full h-full touch-none cursor-move" viewBox={`0 0 ${width} ${height}`} />
       
       {/* Zoom Controls */}
       <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-slate-200 p-1 opacity-100 transition-opacity">
            <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="放大">
                <ZoomIn size={18} />
            </button>
            <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="缩小">
                <ZoomOut size={18} />
            </button>
            <button onClick={handleResetView} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="适配视图">
                <Maximize size={18} />
            </button>
       </div>

       {/* Legend */}
       <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm text-xs border border-slate-100 flex flex-col gap-1 pointer-events-none">
          {Object.keys(progress).length > 0 ? (
            <>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400"></div> 未解锁</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> 可学习</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> 学习中</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> 已掌握</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> 需复习</div>
            </>
          ) : (
             <div className="flex items-center gap-2 text-slate-500">
               <div className="w-3 h-3 rounded-full bg-blue-500"></div> 预览模式
             </div>
          )}
          <div className="mt-1 pt-1 border-t border-slate-200 text-slate-400 text-[10px]">
              支持滚轮缩放 / 拖拽平移
          </div>
       </div>
    </div>
  );
};

export default ForceGraph;