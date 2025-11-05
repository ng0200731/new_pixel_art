// API routes for pattern management
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/patterns - Get all patterns
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, image_data, width, height, rotation, created_at, updated_at FROM patterns ORDER BY created_at DESC'
        );
        res.json({
            success: true,
            count: result.rows.length,
            patterns: result.rows
        });
    } catch (error) {
        console.error('Error fetching patterns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch patterns',
            message: error.message
        });
    }
});

// GET /api/patterns/:id - Get single pattern
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'SELECT * FROM patterns WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Pattern not found'
            });
        }
        
        res.json({
            success: true,
            pattern: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching pattern:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pattern',
            message: error.message
        });
    }
});

// POST /api/patterns - Create new pattern
router.post('/', async (req, res) => {
    try {
        const { name, image_data, width, height, rotation = 0 } = req.body;
        
        // Validation
        if (!name || !image_data || !width || !height) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, image_data, width, height'
            });
        }
        
        const result = await db.query(
            'INSERT INTO patterns (name, image_data, width, height, rotation) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, image_data, width, height, rotation]
        );
        
        res.status(201).json({
            success: true,
            pattern: result.rows[0],
            message: 'Pattern created successfully'
        });
    } catch (error) {
        console.error('Error creating pattern:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create pattern',
            message: error.message
        });
    }
});

// PUT /api/patterns/:id - Update pattern (mainly for rotation)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rotation } = req.body;
        
        if (rotation === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing rotation value'
            });
        }
        
        const result = await db.query(
            'UPDATE patterns SET rotation = $1 WHERE id = $2 RETURNING *',
            [rotation, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Pattern not found'
            });
        }
        
        res.json({
            success: true,
            pattern: result.rows[0],
            message: 'Pattern updated successfully'
        });
    } catch (error) {
        console.error('Error updating pattern:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update pattern',
            message: error.message
        });
    }
});

// DELETE /api/patterns/:id - Delete pattern
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First check if pattern exists
        const checkResult = await db.query(
            'SELECT id FROM patterns WHERE id = $1',
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Pattern not found'
            });
        }
        
        // Delete pattern (cascade will delete applications)
        await db.query('DELETE FROM patterns WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Pattern deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting pattern:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete pattern',
            message: error.message
        });
    }
});

// GET /api/patterns/:id/applications - Check if pattern is applied
router.get('/:id/applications', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            'SELECT color_index FROM pattern_applications WHERE pattern_id = $1',
            [id]
        );
        
        res.json({
            success: true,
            is_applied: result.rows.length > 0,
            applications: result.rows
        });
    } catch (error) {
        console.error('Error checking pattern applications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check applications',
            message: error.message
        });
    }
});

// POST /api/patterns/:id/apply - Mark pattern as applied to color
router.post('/:id/apply', async (req, res) => {
    try {
        const { id } = req.params;
        const { color_index } = req.body;
        
        if (color_index === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing color_index'
            });
        }
        
        await db.query(
            'INSERT INTO pattern_applications (pattern_id, color_index) VALUES ($1, $2) ON CONFLICT (pattern_id, color_index) DO NOTHING',
            [id, color_index]
        );
        
        res.json({
            success: true,
            message: 'Pattern application recorded'
        });
    } catch (error) {
        console.error('Error recording pattern application:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record application',
            message: error.message
        });
    }
});

// DELETE /api/patterns/:id/apply/:color_index - Remove pattern application
router.delete('/:id/apply/:color_index', async (req, res) => {
    try {
        const { id, color_index } = req.params;
        
        await db.query(
            'DELETE FROM pattern_applications WHERE pattern_id = $1 AND color_index = $2',
            [id, color_index]
        );
        
        res.json({
            success: true,
            message: 'Pattern application removed'
        });
    } catch (error) {
        console.error('Error removing pattern application:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove application',
            message: error.message
        });
    }
});

module.exports = router;


