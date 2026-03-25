import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return { client: createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!), url }
}

/**
 * POST — returns a signed upload URL so the client can upload
 * directly to Supabase Storage (bypasses Vercel's 4.5 MB body limit).
 * Body: JSON { dealId, fileName, fileType, bucket? }
 */
export async function POST(req: NextRequest) {
  try {
    const { client: supabaseAdmin, url: SUPABASE_URL } = getSupabaseAdmin()
    // Verify auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await req.json()
    const { dealId, fileName, fileType, bucket: reqBucket } = body
    const bucket = reqBucket || 'deal-media'

    if (!dealId || !fileName) {
      return NextResponse.json({ error: 'dealId und fileName erforderlich' }, { status: 400 })
    }

    const isVideo = (fileType || '').startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mpeg)$/i.test(fileName)
    const isImage = (fileType || '').startsWith('image/') && !isVideo

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Nur Bilder oder Videos erlaubt' }, { status: 400 })
    }

    // Determine extension
    let ext = 'mp4'
    if (isImage) {
      ext = 'jpg'
    } else {
      const nameExt = fileName.split('.').pop()?.toLowerCase()
      if (nameExt && ['mp4', 'mov', 'webm', 'm4v', '3gp'].includes(nameExt)) ext = nameExt
      else if ((fileType || '').includes('quicktime')) ext = 'mov'
      else if ((fileType || '').includes('webm')) ext = 'webm'
    }

    const path = `deals/${dealId}/${crypto.randomUUID()}.${ext}`
    const contentType = isVideo ? (fileType || 'video/mp4') : (fileType || 'image/jpeg')

    // Create signed upload URL (valid 2 hours)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (signError || !signedData) {
      console.error('Signed URL error:', signError)
      return NextResponse.json({ error: `Signed URL fehlgeschlagen: ${signError?.message}` }, { status: 500 })
    }

    // IMPORTANT: Ensure the signedUrl is a FULL absolute URL pointing to Supabase
    // The SDK might return a relative path — we must prefix with Supabase storage URL
    let fullSignedUrl = signedData.signedUrl
    if (fullSignedUrl.startsWith('/')) {
      fullSignedUrl = `${SUPABASE_URL}/storage/v1${fullSignedUrl}`
    } else if (!fullSignedUrl.startsWith('http')) {
      fullSignedUrl = `${SUPABASE_URL}/storage/v1/${fullSignedUrl}`
    }

    // Public URL for after upload
    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)

    console.log('Signed URL generated:', { path, fullSignedUrl: fullSignedUrl.substring(0, 80) + '...' })

    return NextResponse.json({
      signedUrl: fullSignedUrl,
      token: signedData.token,
      path,
      publicUrl: urlData.publicUrl,
      contentType,
      type: isVideo ? 'video' : 'image',
    })
  } catch (err: any) {
    console.error('Upload API error:', err)
    return NextResponse.json({ error: err?.message || 'Upload fehlgeschlagen' }, { status: 500 })
  }
}
