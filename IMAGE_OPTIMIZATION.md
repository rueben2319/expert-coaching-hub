# Image Optimization Implementation

## Overview

Image optimization has been implemented using Supabase's built-in image transformation capabilities, providing CDN-like behavior without requiring an external CDN service.

## Features

### 1. Supabase Image Transformation
- On-the-fly image resizing and format conversion
- WebP and AVIF format support for modern browsers
- Quality control for optimal file size
- Responsive image generation with srcset

### 2. Automatic Optimization
- **Avatars**: Automatically optimized to WebP with cover fit
- **Course Thumbnails**: Optimized to 800x450 with WebP
- **Content Images**: Optimized to max-width 1200px with high quality
- **Lazy Loading**: Native lazy loading for non-critical images

### 3. Progressive Enhancement
- Graceful fallback for browsers that don't support modern formats
- Responsive images with multiple breakpoints
- Automatic format selection based on browser support

## Usage

### Basic Image Optimization

```typescript
import { getOptimizedImageUrl } from '@/lib/image-optimization';

// Get optimized image URL
const optimizedUrl = getOptimizedImageUrl(path, {
  width: 800,
  height: 600,
  quality: 85,
  format: 'webp',
  fit: 'cover',
});
```

### Avatar Optimization

```typescript
import { getOptimizedAvatarUrl } from '@/lib/image-optimization';

// Get optimized avatar URL (150x150 by default)
const avatarUrl = getOptimizedAvatarUrl(avatarPath, 150);
```

### Course Thumbnail Optimization

```typescript
import { getOptimizedThumbnailUrl } from '@/lib/image-optimization';

// Get optimized thumbnail URL (800x450 by default)
const thumbnailUrl = getOptimizedThumbnailUrl(thumbnailPath);
```

### Responsive Images with Srcset

```typescript
import { generateSrcset, getImageAttributes } from '@/lib/image-optimization';

// Generate srcset with multiple breakpoints
const srcset = generateSrcset(
  imagePath,
  { width: 800, quality: 85 },
  [320, 640, 768, 1024, 1280, 1536, 1920]
);

// Get complete img attributes
const imgAttrs = getImageAttributes({
  src: imagePath,
  alt: 'Course thumbnail',
  width: 800,
  height: 450,
  transform: { quality: 85, format: 'webp' },
  loading: 'lazy',
  breakpoints: [320, 640, 768, 1024, 1280, 1536, 1920],
});
```

### Modern Format Support (WebP/AVIF)

```typescript
import { generateModernSrcset } from '@/lib/image-optimization';

// Generate WebP and AVIF URLs
const { webp, avif } = generateModernSrcset(imagePath, {
  width: 800,
  quality: 85,
});

// Use in picture element
<picture>
  <source srcset={avif} type="image/avif" />
  <source srcset={webp} type="image/webp" />
  <img src={originalUrl} alt="Description" />
</picture>
```

### Preloading Critical Images

```typescript
import { preloadImage } from '@/lib/image-optimization';

// Preload hero image
preloadImage(heroImageUrl, 'high');
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Supabase Project ID (for image optimization)
# Extracted from your Supabase project URL: https://[PROJECT_ID].supabase.co
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Supabase Storage

Ensure your Supabase project has:
- Storage buckets configured (avatars, course-files, etc.)
- Public access enabled for buckets that need it
- RLS policies configured appropriately

## Transformation Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `width` | number | Target width in pixels | - |
| `height` | number | Target height in pixels | - |
| `quality` | number | Image quality (1-100) | 80 |
| `format` | string | Output format (webp, avif, pjpg, resize) | origin |
| `fit` | string | Fit mode (cover, contain, fill, outside, inside) | - |
| `gravity` | string | Focus point (center, top, bottom, left, right, smart) | center |

## Performance Benefits

### Before Optimization
- Unoptimized images (full resolution)
- No format conversion (large JPEG/PNG files)
- No responsive sizing (same image for all devices)
- Estimated: 2-5MB per page load

### After Optimization
- Optimized WebP/AVIF formats (30-50% smaller)
- Responsive sizing (appropriate size per device)
- Lazy loading (non-critical images deferred)
- Estimated: 500KB-1MB per page load

**Estimated improvement: 70-80% reduction in image payload**

## Integration with Existing Code

### Avatar Component Update

The `resolveAvatarUrl` function in `src/lib/avatar.ts` has been updated to automatically use optimized URLs:

```typescript
// Before
return publicUrl;

// After
return getOptimizedAvatarUrl(publicUrl);
```

### Course Thumbnail Update

Update course thumbnail components to use `getOptimizedThumbnailUrl`:

```typescript
import { getOptimizedThumbnailUrl } from '@/lib/image-optimization';

const thumbnailUrl = getOptimizedThumbnailUrl(course.thumbnail_url);
```

## Browser Support

- **WebP**: Supported in 95%+ of browsers (Chrome, Firefox, Edge, Safari 14+)
- **AVIF**: Supported in 70%+ of browsers (Chrome 85+, Firefox 93+, Android)
- **Fallback**: Original format served to unsupported browsers

## Monitoring and Testing

### Testing Image Optimization

1. Check network tab in browser DevTools
2. Verify WebP/AVIF formats are being served
3. Check response sizes are reduced
4. Verify LCP (Largest Contentful Paint) improvement

### Performance Metrics

Monitor the following metrics:
- LCP (Largest Contentful Paint)
- Total image payload size
- Number of image requests
- Cache hit rate

## Future Enhancements

Potential improvements for the future:

1. **External CDN Integration**: Add Cloudflare or Cloudinary for global edge caching
2. **Image Caching Headers**: Configure Supabase CDN caching policies
3. **WebP Converter Server**: Server-side WebP conversion for non-Supabase images
4. **Blur Placeholders**: Add blur-up placeholders for smoother loading
5. **Image Sprites**: Combine small icons into sprites for fewer requests
6. **Image Preloading Strategy**: Intelligent preloading based on viewport

## Troubleshooting

### Images Not Optimizing

1. Check `VITE_SUPABASE_PROJECT_ID` is set correctly
2. Verify Supabase storage bucket is public
3. Check browser DevTools for transformation errors
4. Ensure image path is correct

### Format Not Supported

1. Check browser compatibility
2. Verify fallback mechanism is working
3. Test with and without format options

### Large File Sizes

1. Check quality settings (try lower quality)
2. Verify WebP/AVIF is being used
3. Check if image dimensions are appropriate
4. Consider using more aggressive compression

## References

- [Supabase Image Transformation Docs](https://supabase.com/docs/guides/storage/image-transformations)
- [WebP Browser Support](https://caniuse.com/webp)
- [AVIF Browser Support](https://caniuse.com/avif)
- [Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
