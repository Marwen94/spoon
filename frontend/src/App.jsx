import { useState, useEffect } from 'react';
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
        setHistory(data.reports);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                  <h2>Exposure Report</h2>
                  {history.length > 0 && (
                    <button onClick={handleBackToHistory} className="back-btn">
                      ← Back to Reports
                    </button>
                  )}
                </div>
                <div className="summary-card">
                  <div className="score">
                    <span className="label">Exposure Rate</span>
                    <span className="value">{report.exposure_rate}%</span>
                  </div>
                  <p className="summary-text">{report.summary}</p>
                </div>
                
                <h3>Details</h3>
                <div className="stats-grid">
                  <div className="stat">
                    <span className="label">Total Prompts</span>
                    <span className="value">{report.total_prompts}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Mentions</span>
                    <span className="value">{report.brand_mentioned_count}</span>
                  </div>
                  <div className="stat">
                    <span className="label">No Mentions</span>
                    <span className="value">{report.brand_not_mentioned_count}</span>
                  </div>
                </div>

                {report.appeared_examples && report.appeared_examples.length > 0 && (
                  <div className="examples">
                    <h3>Where it appeared</h3>
                    <ul>
                      {report.appeared_examples.map((ex, i) => (
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
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.not_appeared_examples && report.not_appeared_examples.length > 0 && (
                  <div className="examples">
                    <h3>Where it did NOT appear</h3>
                    <ul>
                      {report.not_appeared_examples.map((ex, i) => (
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
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* History Section */}
            {!report && history.length > 0 && (
              <div className="history-section fade-in">
                <h2 className="history-title">Previous Analysis Reports</h2>
                <div className="history-grid">
                  {history.map((h) => (
                    <div 
                      key={h.id} 
                      className="history-card clickable"
                      onClick={() => handleSelectHistoryReport(h)}
                    >
                      <div className="history-header">
                        <span className="history-date">
                          {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <span className="history-rate">{h.exposure_rate.toFixed(1)}% Exposure</span>
                      </div>
                      <div className="history-stats">
                        <span>{h.brand_mentioned_count} / {h.total_prompts} Mentions</span>
                      </div>
                      <p className="history-summary">{h.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;