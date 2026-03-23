import GraphVisualization from './GraphVisualization';
import PromptItem from './PromptItem';
import PropTypes from 'prop-types';
import { useState } from 'react';

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
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!report) return null;

  return (
    <div className="report fade-in">
      <div className="report-header-actions">
        <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>Exposure Analysis</h2>
            <button 
              className="small-btn" 
              style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'transparent', color: '#868e96', border: '1px solid #ced4da' }}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? 'Show' : 'Hide'}
            </button>
          </div>
          {!isCollapsed && (
            <>
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
            </>
          )}
        </div>
          {!isCollapsed && !report.is_aggregated && history.length > 0 && (
            <button onClick={handleBackToHistory} className="back-btn">
              ← Back to Reports
            </button>
          )}
        </div>
        
        {!isCollapsed && (
          <>
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
              <ul className="prompt-list">
                {filteredReport.appeared_examples.map((ex, i) => (
                  <PromptItem 
                    key={`appeared-${i}`}
                    ex={ex}
                    isAppeared={true}
                    handleAddSourceToContext={handleAddSourceToContext}
                    handleAddCompetitorToContext={handleAddCompetitorToContext}
                  />
                ))}
              </ul>
            </div>
          )}

          {filteredReport.not_appeared_examples && filteredReport.not_appeared_examples.length > 0 && (
            <div className="examples">
              <h3>Where it did NOT appear</h3>
              <ul className="prompt-list">
                {filteredReport.not_appeared_examples.map((ex, i) => (
                  <PromptItem 
                    key={`not-appeared-${i}`}
                    ex={ex}
                    isAppeared={false}
                    handleAddSourceToContext={handleAddSourceToContext}
                    handleAddCompetitorToContext={handleAddCompetitorToContext}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
          </>
        )}
    </div>
  );
};

ExposureReport.propTypes = {
  report: PropTypes.object,
  filteredReport: PropTypes.object,
  viewMode: PropTypes.string.isRequired,
  setViewMode: PropTypes.func.isRequired,
  mentionFilter: PropTypes.string.isRequired,
  setMentionFilter: PropTypes.func.isRequired,
  history: PropTypes.array.isRequired,
  handleBackToHistory: PropTypes.func.isRequired,
  handleAddSourceToContext: PropTypes.func.isRequired,
  handleAddCompetitorToContext: PropTypes.func.isRequired,
};

export default ExposureReport;