/**
 * Image Optimization Utilities
 * 
 * Provides image optimization utilities using Supabase Image Transformation
 * Supports responsive images, lazy loading, and CDN-like behavior
 */

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || '';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'origin' | 'webp' | 'avif' | 'pjpg' | 'resize';
  fit?: 'cover' | 'contain' | 'fill' | 'outside' | 'inside';
  resize?: 'cover' | 'contain' | 'fill' | 'outside' | 'inside';
  gravity?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'smart';
}

export interface ResponsiveImageOptions {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  transform?: ImageTransformOptions;
  loading?: 'lazy' | 'eager';
  className?: string;
  sizes?: string;
  breakpoints?: number[];
}

/**
 * Generate optimized image URL with Supabase transformations
 */
export function getOptimizedImageUrl(
  path: string,
  options: ImageTransformOptions = {}
): string {
  if (!path) return '';

  // If it's an external URL or data URL, return as-is
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  // If it's a Supabase storage path, apply transformations
  if (path.startsWith('/storage/v1/object/')) {
    const cleanPath = path.replace('/storage/v1/object/', '');
    const url = new URL(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/render/image/${cleanPath}`,
    );

    // Add transformation parameters
    if (options.width) url.searchParams.set('width', options.width.toString());
    if (options.height) url.searchParams.set('height', options.height.toString());
    if (options.quality) url.searchParams.set('quality', options.quality.toString());
    if (options.format && options.format !== 'origin') {
      url.searchParams.set('format', options.format);
    }
    if (options.resize) url.searchParams.set('resize', options.resize);
    if (options.fit) url.searchParams.set('fit', options.fit);
    if (options.gravity) url.searchParams.set('gravity', options.gravity);

    return url.toString();
  }

  return path;
}

/**
 * Generate responsive image srcset with multiple resolutions
 */
export function generateSrcset(
  path: string,
  options: ImageTransformOptions = {},
  breakpoints: number[] = [320, 640, 768, 1024, 1280, 1536, 1920]
): string {
  if (!path) return '';

  // If external URL, return single source
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  // Generate srcset with different widths
  return breakpoints
    .map(width => {
      const optimizedUrl = getOptimizedImageUrl(path, { ...options, width });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate lazy loading attributes for images
 */
export function getLazyLoadingAttributes(loading: 'lazy' | 'eager' = 'lazy') {
  return {
    loading,
    decoding: loading === 'lazy' ? 'async' : 'auto',
  };
}

/**
 * Generate responsive sizes attribute
 */
export function generateSizes(
  baseWidth: number,
  breakpoints: number[] = [640, 768, 1024, 1280, 1536, 1920]
): string {
  return breakpoints
    .map((bp, index) => {
      const nextBp = breakpoints[index + 1] || bp * 2;
      return `(max-width: ${nextBp}px) ${baseWidth}px`;
    })
    .reverse()
    .join(', ');
}

/**
 * Avatar-specific image optimization
 */
export function getOptimizedAvatarUrl(path: string, size: number = 150): string {
  return getOptimizedImageUrl(path, {
    width: size,
    height: size,
    quality: 80,
    format: 'webp',
    fit: 'cover',
    gravity: 'center',
  });
}

/**
 * Course thumbnail optimization
 */
export function getOptimizedThumbnailUrl(
  path: string,
  width: number = 800,
  height: number = 450
): string {
  return getOptimizedImageUrl(path, {
    width,
    height,
    quality: 85,
    format: 'webp',
    fit: 'cover',
    gravity: 'center',
  });
}

/**
 * Content image optimization (for lesson content)
 */
export function getOptimizedContentUrl(
  path: string,
  maxWidth: number = 1200
): string {
  return getOptimizedImageUrl(path, {
    width: maxWidth,
    quality: 90,
    format: 'webp',
    fit: 'inside',
  });
}

/**
 * Generate WebP and AVIF srcset for modern browsers
 */
export function generateModernSrcset(
  path: string,
  options: ImageTransformOptions = {}
): { webp: string; avif: string } {
  const webpUrl = getOptimizedImageUrl(path, { ...options, format: 'webp' });
  const avifUrl = getOptimizedImageUrl(path, { ...options, format: 'avif' });

  return {
    webp: webpUrl,
    avif: avifUrl,
  };
}

/**
 * Generate picture element with multiple source formats
 */
export function generatePictureElement(
  options: ResponsiveImageOptions
): {
  imgSrc: string;
  sources: Array<{ srcset: string; type: string; media?: string }>;
} {
  const imgSrc = getOptimizedImageUrl(options.src, options.transform);
  const { webp, avif } = generateModernSrcset(options.src, options.transform);

  const sources: Array<{ srcset: string; type: string; media?: string }> = [
    { srcset: avif, type: 'image/avif' },
    { srcset: webp, type: 'image/webp' },
  ];

  // Add responsive sources if breakpoints provided
  if (options.breakpoints && options.breakpoints.length > 0) {
    const avifSrcset = generateSrcset(options.src, { ...options.transform, format: 'avif' }, options.breakpoints);
    const webpSrcset = generateSrcset(options.src, { ...options.transform, format: 'webp' }, options.breakpoints);
    const originalSrcset = generateSrcset(options.src, options.transform, options.breakpoints);

    sources.push(
      { srcset: avifSrcset, type: 'image/avif' },
      { srcset: webpSrcset, type: 'image/webp' },
      { srcset: originalSrcset, type: 'image/jpeg' }
    );
  }

  return {
    imgSrc,
    sources,
  };
}

/**
 * Preload critical images
 */
export function preloadImage(url: string, priority: 'high' | 'low' = 'high'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  link.setAttribute('fetchpriority', priority);
  document.head.appendChild(link);
}

/**
 * Helper to generate React <img> attributes with optimization
 */
export function getImageAttributes(options: ResponsiveImageOptions) {
  const { imgSrc, sources } = generatePictureElement(options);
  const lazyAttrs = getLazyLoadingAttributes(options.loading);
  const srcset = options.breakpoints ? generateSrcset(options.src, options.transform, options.breakpoints) : undefined;
  const sizes = options.breakpoints ? generateSizes(options.width || 800, options.breakpoints) : options.sizes;

  return {
    src: imgSrc,
    srcset,
    sizes,
    alt: options.alt,
    className: options.className,
    ...lazyAttrs,
  };
}
