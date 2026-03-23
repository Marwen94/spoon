import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import PropTypes from 'prop-types';

const GraphVisualization = ({ report, onAddSource, onAddCompetitor }) => {
  const fgRef = useRef();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodeFilter, setNodeFilter] = useState('both'); // 'both', 'sources', 'competitors'

  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth } = containerRef.current.getBoundingClientRect();
      setDimensions({ width: clientWidth, height: 600 });
      
      const handleResize = () => {
        if (containerRef.current) {
          setDimensions({ 
            width: containerRef.current.getBoundingClientRect().width, 
            height: 600 
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const addedSources = new Set();
    const addedCompetitors = new Set();

    const addNode = (id, label, type, val) => {
      const existingNode = nodes.find(n => n.id === id);
      if (!existingNode) {
        nodes.push({ id, label, type, val });
      } else if (type === 'source' || type === 'competitor') {
        // Increase the size of the node if it's referenced again
        existingNode.val += 2;
      }
      return id;
    };

    if (report) {
      // Add central brand node
      addNode(report.domain, report.brand_name || report.domain, 'brand', 15);
      const domainNode = nodes.find(n => n.id === report.domain);
      if (domainNode) {
        domainNode.fx = 0;
        domainNode.fy = 0;
      }

      const processExamples = (examples, isAppeared) => {
        examples.forEach((ex) => {
          // Use a hash or sanitized prompt string as ID to handle duplicate prompts safely across aggregated views
          const promptId = `prompt-${btoa(ex.prompt).substring(0, 15)}-${isAppeared ? 'yes' : 'no'}`;
          
          addNode(promptId, ex.prompt, isAppeared ? 'prompt-yes' : 'prompt-no', 6);
          links.push({
            source: report.domain,
            target: promptId,
            value: 1
          });

          if ((nodeFilter === 'both' || nodeFilter === 'sources') && ex.sources) {
            ex.sources.forEach((sourceUrl) => {
              try {
                const url = new URL(sourceUrl);
                const sourceDomain = url.hostname;
                const sourceId = `source-${sourceDomain}`;
                
                addNode(sourceId, sourceDomain, 'source', 3);
                links.push({
                  source: sourceId,
                  target: promptId,
                  value: 1
                });
                addedSources.add(sourceId);
              } catch {
                // Ignore invalid URLs
              }
            });
          }

          if ((nodeFilter === 'both' || nodeFilter === 'competitors') && ex.competitors_mentioned) {
            ex.competitors_mentioned.forEach((comp) => {
              const compId = `comp-${comp}`;
              addNode(compId, comp, 'competitor', 4);
              links.push({
                source: promptId,
                target: compId,
                value: 1,
                isCompetitorLink: true
              });
              addedCompetitors.add(compId);
            });
          }
        });
      };

      if (report.appeared_examples) processExamples(report.appeared_examples, true);
      if (report.not_appeared_examples) processExamples(report.not_appeared_examples, false);
    }

    return { nodes, links };
  }, [report, nodeFilter]);

  const handleNodeClick = useCallback((node) => {
    if (node.type === 'source' || node.type === 'competitor') {
      const isSource = node.type === 'source';
      const actionText = isSource ? 'Add source' : 'Add competitor';
      
      // Simple custom popup using standard alert/confirm
      // We are just wrapping it in a tiny timeout to not block the click event
      setTimeout(() => {
        if (window.confirm(`${actionText} "${node.label}" to domain context?`)) {
          if (isSource && onAddSource) {
            onAddSource(node.label); // Passing URL for sources
          } else if (!isSource && onAddCompetitor) {
            onAddCompetitor(node.label);
          }
        }
      }, 50);
    }
  }, [onAddSource, onAddCompetitor]);

  useEffect(() => {
    if (fgRef.current) {
      // Adjust forces to make the graph sparser
      fgRef.current.d3Force('charge').strength(-400); // Stronger repulsion (default is around -30)
      fgRef.current.d3Force('link').distance(100); // Longer links (default is around 30)
      
      // Center the graph after a slight delay to let initial layout settle
      setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(400, 50); // duration ms, padding px
        }
      }, 800);
    }
  }, [graphData]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            <input 
              type="radio" 
              name="nodeFilter" 
              value="both" 
              checked={nodeFilter === 'both'} 
              onChange={(e) => setNodeFilter(e.target.value)} 
            />
            Show All
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            <input 
              type="radio" 
              name="nodeFilter" 
              value="sources" 
              checked={nodeFilter === 'sources'} 
              onChange={(e) => setNodeFilter(e.target.value)} 
            />
            Sources Only
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            <input 
              type="radio" 
              name="nodeFilter" 
              value="competitors" 
              checked={nodeFilter === 'competitors'} 
              onChange={(e) => setNodeFilter(e.target.value)} 
            />
            Competitors Only
          </label>
        </div>
        
        <div className="graph-legend" style={{ display: 'flex', gap: '15px', fontSize: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff6b6b', display: 'inline-block' }}></span> Brand
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4dabf7', display: 'inline-block' }}></span> Prompt (Mentioned)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#adb5bd', display: 'inline-block' }}></span> Prompt (Missed)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#51cf66', display: 'inline-block' }}></span> Source
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fcc419', display: 'inline-block' }}></span> Competitor
          </div>
        </div>
      </div>
      
      <div ref={containerRef} style={{ width: '100%', height: '600px', backgroundColor: '#f8f9fa', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="label"
          onNodeClick={handleNodeClick}
          onNodeHover={node => {
            if (containerRef.current) {
              containerRef.current.style.cursor = node && (node.type === 'source' || node.type === 'competitor') ? 'pointer' : 'default';
            }
          }}
          nodeColor={node => {
            if (node.type === 'brand') return '#ff6b6b';
            if (node.type === 'prompt-yes') return '#4dabf7';
            if (node.type === 'prompt-no') return '#adb5bd';
            if (node.type === 'source') return '#51cf66';
            if (node.type === 'competitor') return '#fcc419';
            return '#20c997';
          }}
          nodeVal={node => node.val}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.25}
          linkColor={link => {
            if (link.isCompetitorLink) return 'rgba(252, 196, 25, 0.4)';
            return 'rgba(153, 153, 153, 0.2)';
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.label;
            const fontSize = node.type === 'brand' ? 14/globalScale : 12/globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            
            // Limit max visual node size so it doesn't get ridiculously huge
            const visualVal = Math.min(node.val, 25);
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, visualVal, 0, 2 * Math.PI, false);
            
            if (node.type === 'brand') ctx.fillStyle = '#ff6b6b';
            else if (node.type === 'prompt-yes') ctx.fillStyle = '#4dabf7';
            else if (node.type === 'prompt-no') ctx.fillStyle = '#adb5bd';
            else if (node.type === 'source') ctx.fillStyle = '#51cf66';
            else if (node.type === 'competitor') ctx.fillStyle = '#fcc419';
            else ctx.fillStyle = '#20c997';
            
            ctx.fill();
            
            // Draw label
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#343a40';
            
            // Add background for label for better readability
            if (node.type !== 'prompt-yes' && node.type !== 'prompt-no') {
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 
              
              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + visualVal + 2, bckgDimensions[0], bckgDimensions[1]);
              
              ctx.fillStyle = '#343a40';
              ctx.fillText(label, node.x, node.y + visualVal + 2 + bckgDimensions[1]/2);
            }
          }}
        />
      </div>
    </div>
  );
};

GraphVisualization.propTypes = {
  report: PropTypes.object.isRequired,
  onAddSource: PropTypes.func,
  onAddCompetitor: PropTypes.func,
};

export default GraphVisualization;