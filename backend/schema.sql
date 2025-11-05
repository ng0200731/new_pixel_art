-- Broadloom Pattern Storage Database Schema
-- PostgreSQL

-- Drop tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS pattern_applications CASCADE;
DROP TABLE IF EXISTS patterns CASCADE;

-- Patterns table - stores pattern images and metadata
CREATE TABLE patterns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image_data TEXT NOT NULL,          -- base64 encoded image (data:image/png;base64,...)
    width INTEGER NOT NULL,             -- original image width
    height INTEGER NOT NULL,            -- original image height
    rotation DECIMAL(5,2) DEFAULT 0,   -- rotation angle in degrees
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pattern applications tracking (optional - tracks which patterns are applied to which colors)
-- This helps with deletion confirmation
CREATE TABLE pattern_applications (
    id SERIAL PRIMARY KEY,
    pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
    color_index INTEGER NOT NULL,      -- which color in the palette
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pattern_id, color_index)    -- prevent duplicate applications
);

-- Indexes for performance
CREATE INDEX idx_patterns_created ON patterns(created_at DESC);
CREATE INDEX idx_pattern_apps_pattern ON pattern_applications(pattern_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE
    ON patterns FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample pattern (optional - for testing)
-- INSERT INTO patterns (name, image_data, width, height) VALUES 
-- ('Test Pattern', 'data:image/png;base64,iVBORw0KG...', 100, 100);

-- Success message
SELECT 'Database schema created successfully!' AS status;


