import React from 'react';
import GraphVisualization from './GraphVisualization';

const ExposureReport = ({
  report,
  filteredReport,
  viewMode,
  setViewMode,
  mentionFilter,
  setMentionFilter,
  history,
  handleBackToHistory,
  handleAddSourceToContext,
  handleAddCompetitorToContext,
}) => {
  if (!report) return null;

  return (
    <div className="report fade-in">
      <div className="report-header-actions">
        <div className="header-left">
          <h2>Exposure Report</h2>
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => setViewMode('graph')}
            >
              Graph View
            </button>
          </div>
          <div className="filter-dropdown">
            <select 
              value={mentionFilter} 
              onChange={(e) => setMentionFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Prompts</option>
              <option value="mentioned">Mentioned</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        </div>
        {!report.is_aggregated && history.length > 0 && (
          <button onClick={handleBackToHistory} className="back-btn">
            ← Back to Reports
          </button>
        )}
      </div>

      {viewMode === 'graph' ? (
        <div className="graph-container">
          <GraphVisualization 
            report={filteredReport} 
            onAddSource={handleAddSourceToContext}
            onAddCompetitor={handleAddCompetitorToContext}
          />
        </div>
      ) : (
        <>
          <div className="summary-card">
            <div className="score">
              <span className="label">Exposure Rate</span>
              <span className="value">{filteredReport.exposure_rate}%</span>
            </div>
            <p className="summary-text">{filteredReport.summary}</p>
          </div>
          
          <h3>Details</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Total Prompts</span>
              <span className="value">{filteredReport.total_prompts}</span>
            </div>
            <div className="stat">
              <span className="label">Mentions</span>
              <span className="value">{filteredReport.brand_mentioned_count}</span>
            </div>
            <div className="stat">
              <span className="label">No Mentions</span>
              <span className="value">{filteredReport.brand_not_mentioned_count}</span>
            </div>
          </div>

          {filteredReport.appeared_examples && filteredReport.appeared_examples.length > 0 && (
            <div className="examples">
              <h3>Where it appeared</h3>
              <ul>
                {filteredReport.appeared_examples.map((ex, i) => (
                  <li key={i}>
                    <strong>Prompt:</strong> {ex.prompt}
                    <br/>
                    <small>Context: {ex.mention_context}</small>
                    {ex.sources && ex.sources.length > 0 && (
                      <div className="sources-list">
                        <h4>Sources used:</h4>
                        <ul>
                          {ex.sources.map((source, j) => (
                            <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <a href={source} target="_blank" rel="noopener noreferrer">
                                {source}
                              </a>
                              <button 
                                className="small-btn save" 
                                style={{ padding: '2px 6px', fontSize: '0.75rem', marginLeft: 'auto' }}
                                onClick={() => handleAddSourceToContext(source)}
                                title="Add to Domain Context"
                              >
                                + Add to context
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ex.competitors_mentioned && ex.competitors_mentioned.length > 0 && (
                      <div className="competitors-mentioned">
                        <h4>Competitors mentioned:</h4>
                        <div className="chips-container small">
                          {ex.competitors_mentioned.map((comp, j) => (
                            <span key={j} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {comp}
                              <button 
                                className="small-btn save" 
                                style={{ padding: '0px 4px', fontSize: '0.7rem', borderRadius: '4px', minWidth: 'auto' }}
                                onClick={() => handleAddCompetitorToContext(comp)}
                                title="Add to Domain Context"
                              >
                                + Add
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filteredReport.not_appeared_examples && filteredReport.not_appeared_examples.length > 0 && (
            <div className="examples">
              <h3>Where it did NOT appear</h3>
              <ul>
                {filteredReport.not_appeared_examples.map((ex, i) => (
                  <li key={i}>
                    <strong>Prompt:</strong> {ex.prompt}
                    <br/>
                    {ex.completion_summary && (
                      <>
                        <small>Summary: {ex.completion_summary}</small>
                        <br/>
                      </>
                    )}
                    {ex.sources && ex.sources.length > 0 && (
                      <div className="sources-list">
                        <h4>Sources used:</h4>
                        <ul>
                          {ex.sources.map((source, j) => (
                            <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <a href={source} target="_blank" rel="noopener noreferrer">
                                {source}
                              </a>
                              <button 
                                className="small-btn save" 
                                style={{ padding: '2px 6px', fontSize: '0.75rem', marginLeft: 'auto' }}
                                onClick={() => handleAddSourceToContext(source)}
                                title="Add to Domain Context"
                              >
                                + Add to context
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ex.competitors_mentioned && ex.competitors_mentioned.length > 0 && (
                      <div className="competitors-mentioned">
                        <h4>Competitors mentioned:</h4>
                        <div className="chips-container small">
                          {ex.competitors_mentioned.map((comp, j) => (
                            <span key={j} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {comp}
                              <button 
                                className="small-btn save" 
                                style={{ padding: '0px 4px', fontSize: '0.7rem', borderRadius: '4px', minWidth: 'auto' }}
                                onClick={() => handleAddCompetitorToContext(comp)}
                                title="Add to Domain Context"
                              >
                                + Add
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExposureReport;