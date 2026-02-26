import { useState } from 'react';
import './App.css';

function App() {
  const [domain, setDomain] = useState('');
  const [promptsCount, setPromptsCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!domain) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch('http://localhost:8000/api/v1/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain, prompts_count: parseInt(promptsCount) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Something went wrong');
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>🥄</h1>
      <form onSubmit={handleSubmit} className="search-form">
        <div className="input-group">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain name"
            disabled={loading}
            className="domain-input"
          />
        </div>
        
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

        <button type="submit" disabled={loading || !domain} className="submit-btn">
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {report && (
        <div className="report">
          <h2>Report for {report.domain}</h2>
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

           {report.appeared_examples.length > 0 && (
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
          {report.not_appeared_examples.length > 0 && (
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
    </div>
  );
}

export default App;
