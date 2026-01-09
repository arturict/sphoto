// =============================================================================
// Branding/White-Label Management
// =============================================================================

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BrandingSettings, InstanceMetadata } from './types';
import { INSTANCES_DIR } from './config';

export function getBranding(instanceId: string): BrandingSettings | null {
  const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
  if (!existsSync(metaPath)) return null;
  
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  return meta.branding || null;
}

export function updateBranding(instanceId: string, branding: BrandingSettings): BrandingSettings {
  const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
  if (!existsSync(metaPath)) {
    throw new Error('Instance not found');
  }
  
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  
  // Validate and sanitize branding settings
  const sanitized: BrandingSettings = {};
  
  if (branding.logo_url) {
    sanitized.logo_url = sanitizeUrl(branding.logo_url);
  }
  
  if (branding.primary_color) {
    sanitized.primary_color = sanitizeColor(branding.primary_color);
  }
  
  if (branding.welcome_message) {
    sanitized.welcome_message = branding.welcome_message.slice(0, 500); // Max 500 chars
  }
  
  if (branding.favicon_url) {
    sanitized.favicon_url = sanitizeUrl(branding.favicon_url);
  }
  
  if (branding.app_name) {
    sanitized.app_name = branding.app_name.slice(0, 50); // Max 50 chars
  }
  
  meta.branding = { ...meta.branding, ...sanitized };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  return meta.branding;
}

export function deleteBranding(instanceId: string): void {
  const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
  if (!existsSync(metaPath)) {
    throw new Error('Instance not found');
  }
  
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  delete meta.branding;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

export function generateCustomCss(branding: BrandingSettings): string {
  const cssVars: string[] = [];
  
  if (branding.primary_color) {
    cssVars.push(`--immich-primary: ${branding.primary_color};`);
  }
  
  let css = '';
  
  if (cssVars.length > 0) {
    css += `:root {\n  ${cssVars.join('\n  ')}\n}\n`;
  }
  
  if (branding.logo_url) {
    css += `
/* Custom logo */
.immich-logo, [data-testid="logo"] {
  background-image: url('${branding.logo_url}') !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
}
`;
  }
  
  if (branding.welcome_message) {
    css += `
/* Welcome message */
.login-form::before {
  content: '${branding.welcome_message.replace(/'/g, "\\'")}';
  display: block;
  text-align: center;
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--immich-bg-secondary, #f3f4f6);
  border-radius: 8px;
}
`;
  }
  
  return css;
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.href;
  } catch {
    return '';
  }
}

function sanitizeColor(color: string): string {
  // Allow hex colors, rgb/rgba, and named colors
  const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const rgbPattern = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
  const namedColors = ['red', 'blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'black', 'white', 'gray'];
  
  if (hexPattern.test(color) || rgbPattern.test(color) || namedColors.includes(color.toLowerCase())) {
    return color;
  }
  
  return '';
}
