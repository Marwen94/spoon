import React, { useMemo, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GraphVisualization = ({ report, onAddSource, onAddCompetitor }) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodeFilter, setNodeFilter] = useState('both'); // 'both', 'sources', 'competitors'
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight || 600
      });
    }
  }, [report]);

  const graphRef = React.useRef();

  const graphData = useMemo(() => {
    if (!report) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];
    const nodeMap = new Set();

    const addNode = (id, label, type, group) => {
      if (!nodeMap.has(id)) {
        nodes.push({ id, label, type, group });
        nodeMap.add(id);
      }
    };

    // Add central brand node
    addNode(report.domain, report.brand_name || report.domain, 'brand', 0);

    const processExamples = (examples, isAppeared) => {
      examples.forEach((ex, index) => {
        // Use a hash or sanitized prompt string as ID to handle duplicate prompts safely across aggregated views
        const promptId = `prompt-${btoa(ex.prompt).substring(0, 15)}-${isAppeared ? 'yes' : 'no'}`;
        
        // Add Prompt Node
        addNode(promptId, ex.prompt, 'prompt', isAppeared ? 1 : 2);
        
        // Link Prompt to Brand
        links.push({
          source: promptId,
          target: report.domain,
          label: isAppeared ? 'mentioned' : 'missed',
          color: isAppeared ? '#2b8a3e' : '#e03131',
          dashed: !isAppeared
        });

        // Process Sources
        if ((nodeFilter === 'both' || nodeFilter === 'sources') && ex.sources && ex.sources.length > 0) {
          ex.sources.forEach((sourceUrl, sIndex) => {
            try {
              const url = new URL(sourceUrl);
              const sourceDomain = url.hostname;
              const sourceId = `source-${sourceDomain}`;
              
              addNode(sourceId, sourceDomain, 'source', 3);
              links.push({
                source: sourceId,
                target: promptId,
                label: 'source',
                color: '#adb5bd'
              });
            } catch (e) {
              // invalid URL, ignore or add raw
              const sourceId = `source-${sIndex}-${promptId}`;
              addNode(sourceId, 'Unknown Source', 'source', 3);
              links.push({ source: sourceId, target: promptId, label: 'source', color: '#adb5bd' });
            }
          });
        }

        // Process Competitors
        if ((nodeFilter === 'both' || nodeFilter === 'competitors') && ex.competitors_mentioned && ex.competitors_mentioned.length > 0) {
          ex.competitors_mentioned.forEach(comp => {
            const compId = `comp-${comp.toLowerCase().replace(/\s+/g, '-')}`;
            addNode(compId, comp, 'competitor', 4);
            links.push({
              source: compId,
              target: promptId,
              label: 'competitor',
              color: '#fd7e14' // Orange for competitors
            });
          });
        }
      });
    };

    if (report.appeared_examples) processExamples(report.appeared_examples, true);
    if (report.not_appeared_examples) processExamples(report.not_appeared_examples, false);

    return { nodes, links };
  }, [report, nodeFilter]);

  // Apply custom physics when component mounts or data changes
  useEffect(() => {
    if (graphRef.current) {
      // Access the internal d3 force engine
      graphRef.current.d3Force('charge').strength(-400); // Strong repulsion
      graphRef.current.d3Force('charge').distanceMax(800); // Allow repulsion to act over larger distance
      graphRef.current.d3Force('link').distance(120); // Longer links
      
      // Re-heat simulation to apply new forces smoothly
      graphRef.current.d3ReheatSimulation();
    }
  }, [graphData]);

  // Color mapping based on node group
  const getNodeColor = (node) => {
    switch (node.group) {
      case 0: return '#1c7ed6'; // Brand (Blue)
      case 1: return '#40c057'; // Prompt Mentioned (Green)
      case 2: return '#fa5252'; // Prompt Missed (Red)
      case 3: return '#868e96'; // Source (Grey)
      case 4: return '#fd7e14'; // Competitor (Orange)
      default: return '#cccccc';
    }
  };

  const getNodeSize = (node) => {
    switch (node.group) {
      case 0: return 12; // Brand
      case 1: return 6;  // Prompt
      case 2: return 6;  // Prompt
      case 3: return 4;  // Source
      case 4: return 8;  // Competitor
      default: return 5;
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0.75rem', background: '#f8f9fa', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#495057', marginRight: '0.5rem' }}>
          Show Nodes:
        </label>
        <select 
          value={nodeFilter} 
          onChange={(e) => setNodeFilter(e.target.value)}
          style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '0.85rem', outline: 'none' }}
        >
          <option value="both">Sources & Competitors</option>
          <option value="sources">Sources Only</option>
          <option value="competitors">Competitors Only</option>
        </select>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '600px', backgroundColor: '#f8f9fa' }}>
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="label"
          onNodeClick={(node) => {
            if (node.type === 'source' && onAddSource) {
              if (window.confirm(`Add source "${node.label}" to domain context?`)) {
                onAddSource(node.label);
              }
            } else if (node.type === 'competitor' && onAddCompetitor) {
              if (window.confirm(`Add competitor "${node.label}" to domain context?`)) {
                onAddCompetitor(node.label);
              }
            }
          }}
          onNodeHover={node => {
            if (containerRef.current) {
              containerRef.current.style.cursor = node && (node.type === 'source' || node.type === 'competitor') ? 'pointer' : 'default';
            }
          }}
          nodeColor={getNodeColor}
          nodeVal={getNodeSize}
          linkColor={(link) => link.color}
          linkLineDash={(link) => link.dashed ? [4, 4] : null}
          linkWidth={1.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx, globalScale) => {
            const MAX_FONT_SIZE = 4;
            const LABEL_NODE_MARGIN = getNodeSize(link.target) * 1.5;

            if (!link.label) return;

            const start = link.source;
            const end = link.target;

            // ignore unbound links
            if (typeof start !== 'object' || typeof end !== 'object') return;

            // calculate label positioning
            const textPos = Object.assign(...['x', 'y'].map(c => ({
              [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point
            })));

            const relLink = { x: end.x - start.x, y: end.y - start.y };
            const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;

            let textAngle = Math.atan2(relLink.y, relLink.x);
            // maintain label vertical orientation for legibility
            if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
            if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

            const fontSize = Math.min(MAX_FONT_SIZE, 10 / globalScale);
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Text color based on link type
            ctx.fillStyle = link.color;
            
            ctx.save();
            ctx.translate(textPos.x, textPos.y);
            ctx.rotate(textAngle);
            ctx.fillText(link.label, 0, 0);
            ctx.restore();
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            // Draw standard circle
            const size = getNodeSize(node);
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
            ctx.fillStyle = getNodeColor(node);
            ctx.fill();

            // Add text labels for Brand and Competitors
            if (node.group === 0 || node.group === 4) {
              const label = node.label;
              const fontSize = node.group === 0 ? 14/globalScale : 10/globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = node.group === 0 ? '#1864ab' : '#d9480f'; // Darker text color
              ctx.fillText(label, node.x, node.y + size + (4/globalScale));
            }
          }}
        />
      </div>
    </div>
  );
};

export default GraphVisualization;