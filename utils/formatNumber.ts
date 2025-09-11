/**
 * Format large numbers for display (1K, 1.1M, etc.)
 */
export function formatNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    const formatted = (num / 1000);
    if (formatted % 1 === 0) {
      return `${formatted.toFixed(0)}K`;
    } else {
      return `${formatted.toFixed(1)}K`;
    }
  } else if (num < 1000000000) {
    const formatted = (num / 1000000);
    if (formatted % 1 === 0) {
      return `${formatted.toFixed(0)}M`;
    } else {
      return `${formatted.toFixed(1)}M`;
    }
  } else {
    const formatted = (num / 1000000000);
    if (formatted % 1 === 0) {
      return `${formatted.toFixed(0)}B`;
    } else {
      return `${formatted.toFixed(1)}B`;
    }
  }
}

/**
 * Format view count specifically for videos
 */
export function formatViewCount(views: number): string {
  if (views === 0) return '0';
  if (views === 1) return '1 view';
  
  const formatted = formatNumber(views);
  return `${formatted} views`;
}