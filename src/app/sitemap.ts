import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://app.deal-buddy.app'

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/onboarding`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  // Fetch public deals for sitemap
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: publicDeals } = await supabase
      .from('bets')
      .select('id, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(500)

    const dealPages: MetadataRoute.Sitemap = (publicDeals || []).map((deal) => ({
      url: `${baseUrl}/deal/${deal.id}`,
      lastModified: new Date(deal.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    return [...staticPages, ...dealPages]
  } catch {
    return staticPages
  }
}
