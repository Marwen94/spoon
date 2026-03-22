import { useState, useEffect } from 'react';
import GraphVisualization from './GraphVisualization';
import './App.css';

function App() {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  
  const [promptsCount, setPromptsCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'graph'
  const [mentionFilter, setMentionFilter] = useState('all'); // 'all', 'mentioned', 'missed'
  const [editedIdentityObj, setEditedIdentityObj] = useState({
    brand_name: '',
    core_value_proposition: '',
    target_audience: '',
    key_features: [],
    competitors: []
  });

  // Load domains on mount
  useEffect(() => {
    fetchDomains();
    const savedDomain = localStorage.getItem('selectedDomain');
    if (savedDomain) {
      const parsed = JSON.parse(savedDomain);
      setSelectedDomain(parsed);
      fetchDomainHistory(parsed.name);
    }
  }, []);

  const fetchDomains = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/domains');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      } else {
        console.error("Failed to fetch domains, status:", response.status);
      }
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    try {
      const response = await fetch('http://localhost:8000/api/v1/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.detail?.[0]?.msg || err.detail || "Failed to add domain");
        return;
      }

      const added = await response.json();
      setDomains([added, ...domains.filter(d => d.id !== added.id)]);
      handleSelectDomain(added);
      setNewDomain('');
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server");
    }
  };

  const handleSelectDomain = (domain) => {
    setSelectedDomain(domain);
    localStorage.setItem('selectedDomain', JSON.stringify(domain));
    setReport(null); // Clear previous report when switching domains
    setError(null);
    setIsEditingIdentity(false);
    if (domain.brand_identity) {
      setEditedIdentityObj({
        brand_name: domain.brand_identity.brand_name || '',
        core_value_proposition: domain.brand_identity.core_value_proposition || '',
        target_audience: domain.brand_identity.target_audience || '',
        key_features: domain.brand_identity.key_features || [],
        competitors: domain.brand_identity.competitors || []
      });
    } else {
      setEditedIdentityObj({
        brand_name: '',
        core_value_proposition: '',
        target_audience: '',
        key_features: [],
        competitors: []
      });
    }
    fetchDomainHistory(domain.name);
  };

  const handleSelectHistoryReport = (historyReport) => {
    // Map history report format back to the main report format
    setReport({
      domain: selectedDomain.name,
      exposure_rate: historyReport.exposure_rate,
      total_prompts: historyReport.total_prompts,
      brand_mentioned_count: historyReport.brand_mentioned_count,
      brand_not_mentioned_count: historyReport.brand_not_mentioned_count,
      summary: historyReport.summary,
      appeared_examples: historyReport.appeared_examples || [],
      not_appeared_examples: historyReport.not_appeared_examples || [],
      generated_at: historyReport.created_at
    });
  };

  const fetchDomainHistory = async (domainName) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/domains/${domainName}/reports`);
      if (response.ok) {
        const data = await response.json();
        const reports = data.reports || [];
        setHistory(reports);
        
        // Aggregate all history reports into one master report view
        if (reports.length > 0) {
          aggregateReports(reports, domainName);
        } else {
          setReport(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const aggregateReports = (reportsList, domainName) => {
    let totalPrompts = 0;
    let brandMentionedCount = 0;
    let brandNotMentionedCount = 0;
    const appearedExamples = [];
    const notAppearedExamples = [];
    
    // Deduplicate prompts to avoid showing the exact same prompt multiple times
    const seenPrompts = new Set();

    reportsList.forEach(r => {
      totalPrompts += r.total_prompts;
      brandMentionedCount += r.brand_mentioned_count;
      brandNotMentionedCount += r.brand_not_mentioned_count;
      
      if (r.appeared_examples) {
        r.appeared_examples.forEach(ex => {
          if (!seenPrompts.has(ex.prompt)) {
            appearedExamples.push(ex);
            seenPrompts.add(ex.prompt);
          }
        });
      }
      
      if (r.not_appeared_examples) {
        r.not_appeared_examples.forEach(ex => {
          if (!seenPrompts.has(ex.prompt)) {
            notAppearedExamples.push(ex);
            seenPrompts.add(ex.prompt);
          }
        });
      }
    });

    const exposureRate = totalPrompts > 0 ? ((brandMentionedCount / totalPrompts) * 100).toFixed(1) : 0;

    setReport({
      domain: domainName,
      exposure_rate: exposureRate,
      total_prompts: totalPrompts,
      brand_mentioned_count: brandMentionedCount,
      brand_not_mentioned_count: brandNotMentionedCount,
      summary: `Aggregated analysis from ${reportsList.length} total runs. The brand appeared in ${brandMentionedCount} out of ${totalPrompts} total prompts across all history.`,
      appeared_examples: appearedExamples,
      not_appeared_examples: notAppearedExamples,
      generated_at: new Date().toISOString(),
      is_aggregated: true
    });
  };

  const handleBackToHistory = () => {
    setReport(null);
  };

  const handleDeleteDomain = async (domainName, e) => {
    e.stopPropagation(); // Prevent selecting the domain when clicking delete
    
    if (!window.confirm(`Are you sure you want to delete ${domainName} and all its history?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/v1/domains/${domainName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDomains(domains.filter(d => d.name !== domainName));
        if (selectedDomain && selectedDomain.name === domainName) {
          setSelectedDomain(null);
          localStorage.removeItem('selectedDomain');
          setReport(null);
          setHistory([]);
        }
      } else {
        const err = await response.json();
        alert(err.detail || "Failed to delete domain");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server");
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!selectedDomain) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch('http://localhost:8000/api/v1/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          domain: selectedDomain.name, 
          prompts_count: parseInt(promptsCount) 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.[0]?.msg || errorData.detail || 'Something went wrong');
      }

      const data = await response.json();
      setReport(data);
      fetchDomainHistory(selectedDomain.name);
      
      // Also refresh domains to get potentially updated brand identity
      fetchDomains();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!selectedDomain) return;
    try {
      const response = await fetch(`http://localhost:8000/api/v1/domains/${selectedDomain.name}/brand-identity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_identity: editedIdentityObj })
      });

      if (response.ok) {
        const updatedDomain = { ...selectedDomain, brand_identity: editedIdentityObj };
        setSelectedDomain(updatedDomain);
        localStorage.setItem('selectedDomain', JSON.stringify(updatedDomain));
        setIsEditingIdentity(false);
        fetchDomains(); // refresh the list
      } else {
        alert("Failed to save brand identity");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving brand identity");
    }
  };

  const handleIdentityChange = (field, value) => {
    setEditedIdentityObj(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayIdentityChange = (field, value) => {
    // split by comma and clean up whitespace
    const arr = value.split(',').map(i => i.trim()).filter(i => i);
    setEditedIdentityObj(prev => ({
      ...prev,
      [field]: arr
    }));
  };

  // Filter report data based on mentionFilter
  const filteredReport = report ? {
    ...report,
    appeared_examples: (mentionFilter === 'all' || mentionFilter === 'mentioned') ? report.appeared_examples : [],
    not_appeared_examples: (mentionFilter === 'all' || mentionFilter === 'missed') ? report.not_appeared_examples : [],
  } : null;

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>🥄 SPOON</h2>
        </div>
        
        <div className="sidebar-section">
          <h3>Registered Domains</h3>
          <ul className="domain-list">
            {domains.map((d) => (
              <li 
                key={d.id} 
                className={`domain-item ${selectedDomain?.id === d.id ? 'active' : ''}`}
                onClick={() => handleSelectDomain(d)}
              >
                <span className="domain-name">{d.name}</span>
                <button 
                  className="delete-domain-btn"
                  onClick={(e) => handleDeleteDomain(d.name, e)}
                  title="Delete domain"
                >
                  ×
                </button>
              </li>
            ))}
            {domains.length === 0 && (
              <li className="empty-text">No domains registered</li>
            )}
          </ul>
        </div>

        <div className="sidebar-section add-domain-section">
          <h3>Add New Domain</h3>
          <form onSubmit={handleAddDomain} className="add-domain-form">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g., example.com"
              className="small-input"
            />
            <button type="submit" className="small-btn" disabled={!newDomain}>
              Add
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {!selectedDomain ? (
          <div className="welcome-state">
            <h1>Welcome to SPOON</h1>
            <p>Select a domain from the sidebar or register a new one to start analyzing brand exposure on Perplexity AI.</p>
          </div>
        ) : (
          <div className="analysis-view">
            <header className="content-header">
              <h1>Analyzing: <strong>{selectedDomain.name}</strong></h1>
            </header>

            {!report && selectedDomain.brand_identity && (
              <div className="brand-identity-section fade-in">
                <div className="identity-header">
                  <h2>Brand Identity</h2>
                  {!isEditingIdentity ? (
                    <button className="small-btn" onClick={() => setIsEditingIdentity(true)}>Edit</button>
                  ) : (
                    <div className="identity-actions">
                      <button className="small-btn cancel" onClick={() => {
                        setIsEditingIdentity(false);
                        if (selectedDomain.brand_identity) {
                          setEditedIdentityObj({
                            brand_name: selectedDomain.brand_identity.brand_name || '',
                            core_value_proposition: selectedDomain.brand_identity.core_value_proposition || '',
                            target_audience: selectedDomain.brand_identity.target_audience || '',
                            key_features: selectedDomain.brand_identity.key_features || [],
                            competitors: selectedDomain.brand_identity.competitors || []
                          });
                        }
                      }}>Cancel</button>
                      <button className="small-btn save" onClick={handleSaveIdentity}>Save</button>
                    </div>
                  )}
                </div>
                {isEditingIdentity ? (
                  <div className="identity-form">
                    <div className="form-group">
                      <label>Brand Name</label>
                      <input 
                        type="text" 
                        value={editedIdentityObj.brand_name} 
                        onChange={(e) => handleIdentityChange('brand_name', e.target.value)} 
                        className="identity-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Value Proposition</label>
                      <textarea 
                        value={editedIdentityObj.core_value_proposition} 
                        onChange={(e) => handleIdentityChange('core_value_proposition', e.target.value)}
                        className="identity-input"
                        rows={3}
                      />
                    </div>
                    <div className="form-group">
                      <label>Target Audience</label>
                      <input 
                        type="text" 
                        value={editedIdentityObj.target_audience} 
                        onChange={(e) => handleIdentityChange('target_audience', e.target.value)}
                        className="identity-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Key Features (comma separated)</label>
                      <input 
                        type="text" 
                        value={editedIdentityObj.key_features.join(', ')} 
                        onChange={(e) => handleArrayIdentityChange('key_features', e.target.value)}
                        className="identity-input"
                        placeholder="Feature 1, Feature 2, Feature 3"
                      />
                    </div>
                    <div className="form-group">
                      <label>Competitors (comma separated)</label>
                      <input 
                        type="text" 
                        value={editedIdentityObj.competitors.join(', ')} 
                        onChange={(e) => handleArrayIdentityChange('competitors', e.target.value)}
                        className="identity-input"
                        placeholder="Competitor A, Competitor B"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="identity-viewer friendly">
                    {selectedDomain.brand_identity.brand_name && (
                      <div className="identity-field">
                        <strong>Brand Name:</strong>
                        <p>{selectedDomain.brand_identity.brand_name}</p>
                      </div>
                    )}
                    {selectedDomain.brand_identity.core_value_proposition && (
                      <div className="identity-field">
                        <strong>Value Proposition:</strong>
                        <p>{selectedDomain.brand_identity.core_value_proposition}</p>
                      </div>
                    )}
                    {selectedDomain.brand_identity.target_audience && (
                      <div className="identity-field">
                        <strong>Target Audience:</strong>
                        <p>{selectedDomain.brand_identity.target_audience}</p>
                      </div>
                    )}
                    {selectedDomain.brand_identity.key_features && Array.isArray(selectedDomain.brand_identity.key_features) && (
                      <div className="identity-field">
                        <strong>Key Features:</strong>
                        <ul>
                          {selectedDomain.brand_identity.key_features.map((feature, i) => (
                            <li key={i}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDomain.brand_identity.competitors && Array.isArray(selectedDomain.brand_identity.competitors) && selectedDomain.brand_identity.competitors.length > 0 && (
                      <div className="identity-field">
                        <strong>Competitors:</strong>
                        <div className="chips-container">
                          {selectedDomain.brand_identity.competitors.map((comp, i) => (
                            <span key={i} className="chip">{comp}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleAnalyze} className="analysis-form">
              <div className="settings-group">
                <label htmlFor="prompts-count" className="settings-label">
                  Number of prompts
                </label>
                <input
                  id="prompts-count"
                  type="number"
                  value={promptsCount}
                  onChange={(e) => setPromptsCount(e.target.value)}
                  min="1"
                  max="20"
                  disabled={loading}
                  className="number-input small"
                />
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </form>

            {error && <div className="error">{error}</div>}

            {report && (
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
                    <GraphVisualization report={filteredReport} />
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
                                      <li key={j}>
                                        <a href={source} target="_blank" rel="noopener noreferrer">
                                          {source}
                                        </a>
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
                                      <span key={j} className="chip">{comp}</span>
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
                                      <li key={j}>
                                        <a href={source} target="_blank" rel="noopener noreferrer">
                                          {source}
                                        </a>
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
                                      <span key={j} className="chip">{comp}</span>
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;