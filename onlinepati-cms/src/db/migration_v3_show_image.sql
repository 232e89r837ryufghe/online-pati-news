-- Migration: Add show_image column to posts table
ALTER TABLE posts ADD COLUMN show_image INTEGER DEFAULT 1;
