import React from 'react';

const AnalysisForm = ({
  promptsCount,
  setPromptsCount,
  loading,
  handleAnalyze,
}) => {
  return (
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
  );
};

export default AnalysisForm;