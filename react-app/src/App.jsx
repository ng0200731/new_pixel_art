import React, { useEffect } from 'react'

export default function App(){
  // Inject scripts in-order and only dispatch DOMContentLoaded after both loaded
  useEffect(() => {
    const loadApp = () => {
      const s2 = document.createElement('script')
      s2.src = '/app-legacy.js'
      s2.defer = true
      s2.onload = () => {
        const evt = new Event('DOMContentLoaded')
        document.dispatchEvent(evt)
      }
      document.body.appendChild(s2)
    }
    const s1 = document.createElement('script')
    s1.src = '/kmeans.js'
    s1.defer = true
    s1.onload = loadApp
    document.body.appendChild(s1)
    return () => {
      // Best-effort cleanup: remove injected scripts if present
      if (s1.parentNode) s1.parentNode.removeChild(s1)
      const s2 = document.querySelector('script[src="/app-legacy.js"]')
      if (s2 && s2.parentNode) s2.parentNode.removeChild(s2)
    }
  }, [])

  return (
    <div className="container">
      <div className="main-content">
        <div className="images-panel">
          <div id="drop-zone" className="drop-zone">
            <div className="drop-zone-content">
              <svg className="upload-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <h3>Drag & Drop Image Here</h3>
              <p>or</p>
              <label htmlFor="image-upload" className="browse-button">
                Browse Files
                <input type="file" id="image-upload" accept="image/*" hidden />
              </label>
              <p className="file-info">Supports: JPG, PNG, GIF, BMP</p>
            </div>
          </div>
          <div id="image-display" className="image-display" style={{display:'none'}}>
            <div className="image-container">
              <div className="image-box">
                <h3>Original</h3>
                <canvas id="original-canvas" className="image-canvas"></canvas>
              </div>
              <div className="image-box">
                <h3>Pixel</h3>
                <canvas id="quantized-canvas" className="image-canvas"></canvas>
              </div>
            </div>
            <div id="magnifier" className="magnifier magnifier-pixel" style={{display:'none'}}>
              <canvas id="magnifier-canvas"></canvas>
            </div>
            <div id="magnifier-original" className="magnifier magnifier-original" style={{display:'none'}}>
              <canvas id="magnifier-canvas-original"></canvas>
            </div>
            <div id="crosshair-horizontal" className="crosshair crosshair-horizontal" style={{display:'none'}}></div>
            <div id="crosshair-vertical" className="crosshair crosshair-vertical" style={{display:'none'}}></div>
          </div>
        </div>
        <div className="controls-panel">
          <div className="control-section">
            <label className="section-title">Resolution:</label>
            <div className="resolution-options">
              <label className="radio-option">
                <input type="radio" name="resolution" value="58" defaultChecked />
                <span className="radio-label">58 yarn lines/cm (Standard)</span>
              </label>
              <label className="radio-option">
                <input type="radio" name="resolution" value="116" />
                <span className="radio-label">116 yarn lines/cm (High Detail)</span>
              </label>
            </div>
            <div id="resolution-recommendation" className="recommendation"></div>
            <label className="checkbox-option">
              <input type="checkbox" id="show-grid" name="show-grid" />
              <span className="checkbox-label">Show Grid</span>
            </label>
            <label className="checkbox-option">
              <input type="checkbox" id="use-actual-colors" name="use-actual-colors" defaultChecked />
              <span className="checkbox-label">Use Actual Colors Only</span>
            </label>
          </div>

          <div className="control-section">
            <label className="section-title">Number of Colors (K):</label>
            <div className="k-controls">
              <button id="k-minus" className="k-button">−</button>
              <div className="k-display">
                <span id="k-value">10</span>
                <span className="k-label">colors</span>
              </div>
              <button id="k-plus" className="k-button">+</button>
            </div>
            <div className="k-range">Min: 2 | Max: 16</div>
            <label className="checkbox-option" style={{marginTop:'8px'}}>
              <input type="checkbox" id="auto-k" name="auto-k" />
              <span className="checkbox-label">Auto K (recommend best K)</span>
            </label>
            <div id="auto-k-note" className="recommendation"></div>
          </div>

          <div className="control-section action-buttons">
            <button id="convert-btn" className="primary-button" disabled>Convert Image</button>
            <button id="download-btn" className="secondary-button" disabled>Download yarn map (csv)</button>
            <button id="download-bmp-btn" className="secondary-button" disabled>Download pixel image (bmp)</button>
          </div>

          <div id="image-info" className="control-section info-panel"></div>

          <div id="color-palette" className="control-section color-palette">
            <div className="palette-header">
              <h4>Color Palette <span id="active-color-count" className="active-color-count"></span></h4>
              <div className="sort-buttons">
                <button id="sort-brightness" className="sort-btn active" title="Sort by brightness">☀️ %</button>
                <button id="sort-pixels" className="sort-btn" title="Sort by pixel count">📊 %</button>
              </div>
            </div>
            <div className="replace-controls">
              <button id="replace-color-btn" className="sort-btn replace-btn" title="Replace one color with another">Replace Color</button>
              <div id="replace-instructions" className="replace-instructions" style={{display:'none'}}>☀️ %  📊 %  (pls pick the replaced order)</div>
            </div>
            <div id="palette-rows" className="palette-rows"></div>
          </div>

          <div id="adjacent-panel" className="control-section adjacent-panel">
            <h4 className="section-title">Adjacent</h4>
            <div id="adjacent-target-options" className="adjacent-mirror"></div>
            <div className="adjacent-controls">
              <button id="ignore-color-btn" className="sort-btn" disabled>Ignore color</button>
              <div id="adjacent-instructions" className="adjacent-instructions"></div>
              <div id="ignore-chips" className="ignore-chips"></div>
              <button id="replace-surround-btn" className="sort-btn" disabled>Replace by #1 color surround</button>
            </div>
          </div>

          <div id="pattern-panel" className="control-section pattern-panel">
            <h4 className="section-title">Pattern</h4>
            <div id="pattern-drop-zone" className="pattern-drop-zone">
              <div className="pattern-drop-content">
                <svg className="pattern-upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p>Drag & Drop Pattern Image</p>
                <label htmlFor="pattern-upload" className="pattern-browse-button">
                  Browse
                  <input type="file" id="pattern-upload" accept="image/*" hidden />
                </label>
              </div>
            </div>
            <div id="pattern-display" className="pattern-display" style={{display:'none'}}>
              <img id="pattern-image" className="pattern-image" alt="Pattern" />
              <button id="pattern-clear-btn" className="pattern-clear-btn" title="Clear pattern">×</button>
            </div>
          </div>

          <div id="k-info" className="control-section k-info-panel" style={{display:'none'}}>
            <h3 className="section-title">Color Reduction Analysis (K = <span id="current-k">10</span>)</h3>
            <div className="pros-cons-container">
              <div className="pros-section">
                <h4>✅ Advantages</h4>
                <ul id="pros-list"></ul>
              </div>
              <div className="cons-section">
                <h4>⚠️ Considerations</h4>
                <ul id="cons-list"></ul>
              </div>
            </div>
          </div>

          <div id="coord-badge" className="coord-badge" style={{display:'none'}}>(0,0)</div>
          <div id="proof-badge" className="coord-badge" style={{display:'none'}}>proof</div>
        </div>
      </div>

      <div id="processing-overlay" className="overlay" style={{display:'none'}}>
        <div className="spinner"></div>
        <div className="processing-text">Processing image...</div>
        <div className="progress-bar"><div className="progress-fill" id="progress-fill"></div></div>
      </div>
    </div>
  )
}


