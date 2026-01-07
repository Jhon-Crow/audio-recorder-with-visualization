import { Visualizer, VisualizerOptions } from './types';
import { BaseVisualizer } from './visualizers';

/**
 * Error thrown when custom visualizer loading fails
 */
export class CustomVisualizerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CustomVisualizerError';
  }
}

/**
 * Interface for the custom visualizer module structure
 */
export interface CustomVisualizerModule {
  /** The visualizer class - must extend BaseVisualizer or implement Visualizer interface */
  default?: new (options?: VisualizerOptions) => Visualizer;
  /** Alternative: the visualizer class as a named export */
  Visualizer?: new (options?: VisualizerOptions) => Visualizer;
  /** Metadata about the visualizer */
  metadata?: CustomVisualizerMetadata;
}

/**
 * Metadata for custom visualizers
 */
export interface CustomVisualizerMetadata {
  /** Unique identifier for the visualizer */
  id: string;
  /** Display name for the visualizer */
  name: string;
  /** Description of the visualizer */
  description?: string;
  /** Author of the visualizer */
  author?: string;
  /** Version of the visualizer */
  version?: string;
  /** Custom options schema (for UI generation) */
  customOptions?: CustomOptionSchema[];
}

/**
 * Schema for custom visualizer options (used for UI generation)
 */
export interface CustomOptionSchema {
  /** Key name for the option */
  key: string;
  /** Display label */
  label: string;
  /** Option type */
  type: 'number' | 'string' | 'boolean' | 'color' | 'select';
  /** Default value */
  defaultValue: unknown;
  /** Min value (for number type) */
  min?: number;
  /** Max value (for number type) */
  max?: number;
  /** Step value (for number type) */
  step?: number;
  /** Options (for select type) */
  options?: { label: string; value: string | number }[];
  /** Description of the option */
  description?: string;
}

/**
 * Loaded custom visualizer info
 */
export interface LoadedCustomVisualizer {
  /** The visualizer instance */
  visualizer: Visualizer;
  /** The visualizer class */
  VisualizerClass: new (options?: VisualizerOptions) => Visualizer;
  /** Metadata about the visualizer */
  metadata: CustomVisualizerMetadata;
  /** Source file name */
  fileName: string;
  /** Source code (if available) */
  sourceCode?: string;
}

/**
 * Utility class for loading custom visualizers from JavaScript files
 *
 * Custom visualizers can be uploaded as JS files that export a class extending BaseVisualizer.
 * The loader validates the code and creates a visualizer instance.
 */
export class CustomVisualizerLoader {
  private loadedVisualizers: Map<string, LoadedCustomVisualizer> = new Map();
  private debug: boolean;

  constructor(options: { debug?: boolean } = {}) {
    this.debug = options.debug ?? false;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[CustomVisualizerLoader]', ...args);
    }
  }

  /**
   * Load a custom visualizer from a JavaScript file
   * @param file - The JavaScript file containing the visualizer
   * @param options - Initial visualizer options
   * @returns The loaded visualizer info
   */
  async loadFromFile(file: File, options?: VisualizerOptions): Promise<LoadedCustomVisualizer> {
    this.log('Loading custom visualizer from file:', file.name);

    // Validate file type
    if (!file.name.endsWith('.js') && !file.name.endsWith('.mjs')) {
      throw new CustomVisualizerError(
        'Invalid file type. Only .js and .mjs files are supported.',
        'INVALID_FILE_TYPE'
      );
    }

    // Read file content
    const sourceCode = await this.readFileAsText(file);

    // Load and validate the visualizer
    const result = await this.loadFromSource(sourceCode, file.name, options);
    result.sourceCode = sourceCode;

    return result;
  }

  /**
   * Load a custom visualizer from source code string
   * @param sourceCode - The JavaScript source code
   * @param fileName - Name for identification (optional)
   * @param options - Initial visualizer options
   * @returns The loaded visualizer info
   */
  async loadFromSource(
    sourceCode: string,
    fileName: string = 'custom-visualizer.js',
    options?: VisualizerOptions
  ): Promise<LoadedCustomVisualizer> {
    this.log('Loading custom visualizer from source, length:', sourceCode.length);

    // Basic validation
    this.validateSourceCode(sourceCode);

    // Create the visualizer module
    const module = await this.evaluateModule(sourceCode, fileName);

    // Get the visualizer class
    const VisualizerClass = module.default || module.Visualizer;
    if (!VisualizerClass) {
      throw new CustomVisualizerError(
        'No visualizer class found. Export the class as default or as "Visualizer".',
        'NO_VISUALIZER_CLASS'
      );
    }

    // Validate it's a constructor
    if (typeof VisualizerClass !== 'function') {
      throw new CustomVisualizerError(
        'Exported value is not a constructor/class.',
        'INVALID_CONSTRUCTOR'
      );
    }

    // Create an instance to validate it implements Visualizer interface
    let visualizer: Visualizer;
    try {
      visualizer = new VisualizerClass(options);
    } catch (error) {
      throw new CustomVisualizerError(
        `Failed to instantiate visualizer: ${error instanceof Error ? error.message : String(error)}`,
        'INSTANTIATION_FAILED'
      );
    }

    // Validate the instance implements required interface
    this.validateVisualizerInstance(visualizer);

    // Extract metadata
    const metadata: CustomVisualizerMetadata = module.metadata || {
      id: visualizer.id || `custom-${Date.now()}`,
      name: visualizer.name || fileName.replace(/\.(js|mjs)$/, ''),
    };

    const result: LoadedCustomVisualizer = {
      visualizer,
      VisualizerClass,
      metadata,
      fileName,
    };

    // Store in registry
    this.loadedVisualizers.set(metadata.id, result);
    this.log('Successfully loaded custom visualizer:', metadata.name);

    return result;
  }

  /**
   * Create a new instance of a previously loaded visualizer
   * @param id - The visualizer ID
   * @param options - Visualizer options
   * @returns A new visualizer instance
   */
  createInstance(id: string, options?: VisualizerOptions): Visualizer {
    const loaded = this.loadedVisualizers.get(id);
    if (!loaded) {
      throw new CustomVisualizerError(
        `No loaded visualizer with id: ${id}`,
        'NOT_FOUND'
      );
    }
    return new loaded.VisualizerClass(options);
  }

  /**
   * Get all loaded custom visualizers
   */
  getLoadedVisualizers(): LoadedCustomVisualizer[] {
    return Array.from(this.loadedVisualizers.values());
  }

  /**
   * Get a specific loaded visualizer by ID
   */
  getLoadedVisualizer(id: string): LoadedCustomVisualizer | undefined {
    return this.loadedVisualizers.get(id);
  }

  /**
   * Remove a loaded visualizer
   */
  removeVisualizer(id: string): boolean {
    return this.loadedVisualizers.delete(id);
  }

  /**
   * Clear all loaded visualizers
   */
  clearAll(): void {
    this.loadedVisualizers.clear();
  }

  /**
   * Read a file as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new CustomVisualizerError(
        'Failed to read file.',
        'FILE_READ_ERROR'
      ));
      reader.readAsText(file);
    });
  }

  /**
   * Basic validation of source code
   */
  private validateSourceCode(sourceCode: string): void {
    // Check for minimum content
    if (!sourceCode || sourceCode.trim().length < 50) {
      throw new CustomVisualizerError(
        'Source code is too short or empty.',
        'EMPTY_SOURCE'
      );
    }

    // Check for required patterns
    const hasClass = /class\s+\w+/.test(sourceCode);
    const hasDrawMethod = /draw\s*\(/.test(sourceCode);

    if (!hasClass) {
      throw new CustomVisualizerError(
        'No class definition found in source code.',
        'NO_CLASS'
      );
    }

    if (!hasDrawMethod) {
      throw new CustomVisualizerError(
        'No draw method found. Custom visualizers must implement a draw() method.',
        'NO_DRAW_METHOD'
      );
    }
  }

  /**
   * Evaluate the module source code and return exports
   */
  private async evaluateModule(sourceCode: string, _fileName: string): Promise<CustomVisualizerModule> {
    // Transform the source code to work as a module
    // We need to handle both ES modules and CommonJS-style exports

    // Create a wrapper that captures exports
    const wrappedCode = `
      const __exports__ = {};
      const module = { exports: __exports__ };
      const exports = __exports__;

      // Provide BaseVisualizer as a global for the custom code
      const BaseVisualizer = window.__AudioVisualizerBaseClass__;

      ${sourceCode}

      // Handle different export styles
      if (typeof __exports__.default !== 'undefined') {
        return __exports__;
      }
      if (typeof __exports__.Visualizer !== 'undefined') {
        return __exports__;
      }
      // Check for direct class assignment to module.exports
      if (typeof module.exports === 'function') {
        return { default: module.exports };
      }
      // Check for named class in exports
      const classKeys = Object.keys(__exports__).filter(k =>
        typeof __exports__[k] === 'function' &&
        /^[A-Z]/.test(k) &&
        k.includes('Visualizer')
      );
      if (classKeys.length > 0) {
        return { default: __exports__[classKeys[0]], ...__exports__ };
      }
      return __exports__;
    `;

    try {
      // Make BaseVisualizer available globally for the custom code
      (window as unknown as Record<string, unknown>).__AudioVisualizerBaseClass__ = BaseVisualizer;

      // Create and execute the function
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const moduleFactory = new AsyncFunction(wrappedCode);
      const result = await moduleFactory();

      return result as CustomVisualizerModule;
    } catch (error) {
      throw new CustomVisualizerError(
        `Failed to evaluate visualizer code: ${error instanceof Error ? error.message : String(error)}`,
        'EVALUATION_FAILED'
      );
    }
  }

  /**
   * Validate that an instance properly implements the Visualizer interface
   */
  private validateVisualizerInstance(instance: unknown): asserts instance is Visualizer {
    if (!instance || typeof instance !== 'object') {
      throw new CustomVisualizerError(
        'Visualizer instance is not an object.',
        'INVALID_INSTANCE'
      );
    }

    const visualizer = instance as Record<string, unknown>;

    // Check required properties
    if (typeof visualizer.id !== 'string' || !visualizer.id) {
      throw new CustomVisualizerError(
        'Visualizer must have a non-empty "id" string property.',
        'MISSING_ID'
      );
    }

    if (typeof visualizer.name !== 'string' || !visualizer.name) {
      throw new CustomVisualizerError(
        'Visualizer must have a non-empty "name" string property.',
        'MISSING_NAME'
      );
    }

    // Check required methods
    if (typeof visualizer.init !== 'function') {
      throw new CustomVisualizerError(
        'Visualizer must have an "init" method.',
        'MISSING_INIT'
      );
    }

    if (typeof visualizer.draw !== 'function') {
      throw new CustomVisualizerError(
        'Visualizer must have a "draw" method.',
        'MISSING_DRAW'
      );
    }

    if (typeof visualizer.destroy !== 'function') {
      throw new CustomVisualizerError(
        'Visualizer must have a "destroy" method.',
        'MISSING_DESTROY'
      );
    }
  }

  /**
   * Generate a template for creating custom visualizers
   * This can be used to provide users with a starting point
   */
  static generateTemplate(options: { name?: string; id?: string } = {}): string {
    const name = options.name || 'MyCustomVisualizer';
    const id = options.id || 'my-custom-visualizer';

    return `/**
 * Custom Visualizer: ${name}
 *
 * This is a template for creating custom audio visualizers.
 * The visualizer receives audio frequency and time domain data each frame.
 *
 * Required:
 * - id: Unique string identifier
 * - name: Display name for the visualizer
 * - init(canvas, options): Initialize the visualizer
 * - draw(ctx, data): Draw a single frame
 * - destroy(): Clean up resources
 *
 * Optional:
 * - setOptions(options): Update options at runtime
 */

// Metadata about the visualizer (optional but recommended)
export const metadata = {
  id: '${id}',
  name: '${name}',
  description: 'A custom audio visualizer',
  author: 'Your Name',
  version: '1.0.0',
  customOptions: [
    {
      key: 'intensity',
      label: 'Intensity',
      type: 'number',
      defaultValue: 1,
      min: 0.1,
      max: 2,
      step: 0.1,
      description: 'Controls the visualization intensity'
    }
  ]
};

/**
 * Custom Visualizer Class
 *
 * You can extend BaseVisualizer for helper methods like:
 * - drawBackground(ctx, data) - draws background color or image
 * - drawForeground(ctx, data) - draws foreground overlay
 * - applyTransform(ctx, data) - applies offset and scale
 * - restoreTransform(ctx, data) - restores transform and handles mirror
 * - createGradient(ctx, x0, y0, x1, y1) - creates a gradient with primary/secondary colors
 *
 * Or implement the Visualizer interface directly for full control.
 */
class ${name} extends BaseVisualizer {
  // Required: unique identifier
  id = '${id}';

  // Required: display name
  name = '${name}';

  // Your custom state variables
  #previousValues = [];

  constructor(options = {}) {
    super({
      // Default options
      primaryColor: '#00ff88',
      secondaryColor: '#0088ff',
      backgroundColor: '#000000',
      lineWidth: 2,
      smoothing: 0.8,
      // Merge with provided options
      ...options,
    });
  }

  /**
   * Draw a single visualization frame
   * @param ctx - Canvas 2D rendering context
   * @param data - Visualization data containing:
   *   - frequencyData: Uint8Array of frequency values (0-255)
   *   - timeDomainData: Uint8Array of waveform values (0-255, 128 = silence)
   *   - width: Canvas width in pixels
   *   - height: Canvas height in pixels
   *   - timestamp: Current time in milliseconds
   *   - sampleRate: Audio sample rate
   *   - fftSize: FFT size used for analysis
   */
  draw(ctx, data) {
    const { width, height, frequencyData, timeDomainData, timestamp } = data;

    // Draw background (handles images too)
    this.drawBackground(ctx, data);

    // Apply layer effects if configured
    this.applyLayerEffect(ctx, data);

    // Apply position/scale transform
    this.applyTransform(ctx, data);

    // Apply visualization alpha
    const alpha = this.options.visualizationAlpha ?? 1;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;

    // ============================================
    // YOUR CUSTOM VISUALIZATION CODE HERE
    // ============================================

    // Example: Simple frequency bars
    const barCount = 32;
    const barWidth = width / barCount;
    const step = Math.floor(frequencyData.length / barCount);

    // Initialize smoothing array
    if (this.#previousValues.length !== barCount) {
      this.#previousValues = new Array(barCount).fill(0);
    }

    // Get custom intensity from options
    const intensity = this.options.custom?.intensity ?? 1;

    for (let i = 0; i < barCount; i++) {
      // Average frequency values for this bar
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const value = (sum / step / 255) * intensity;

      // Apply smoothing
      const smoothing = this.options.smoothing ?? 0.8;
      const smoothedValue = this.#previousValues[i] * smoothing + value * (1 - smoothing);
      this.#previousValues[i] = smoothedValue;

      // Calculate bar height
      const barHeight = smoothedValue * height;
      const x = i * barWidth;
      const y = height - barHeight;

      // Create gradient
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, this.options.primaryColor);
      gradient.addColorStop(1, this.options.secondaryColor);

      // Draw the bar
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    }

    // ============================================
    // END OF CUSTOM VISUALIZATION CODE
    // ============================================

    // Restore alpha
    ctx.globalAlpha = prevAlpha;

    // Restore transform (handles horizontal mirror)
    this.restoreTransform(ctx, data);

    // Draw foreground overlay if configured
    this.drawForeground(ctx, data);
  }
}

// Export the visualizer class as default
export default ${name};
`;
  }
}
