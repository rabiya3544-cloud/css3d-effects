// api/microlink.js
import createClient from 'microlink.io'

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type, url, query, options = {} } = req.body

  // 2. Basic validation
  if (!type) {
    return res.status(400).json({ error: 'Missing "type" parameter (e.g., "screenshot")' })
  }

  // 3. Initialize SDK
  const microlink = createClient({
    apiKey: process.env.MICROLINK_API_KEY
  })

  try {
    let result

    // 4. Route to the correct method
    switch (type) {
      case 'screenshot':
        if (!url) return res.status(400).json({ error: 'Missing "url" for screenshot' })
        result = await microlink.screenshot(url, options)
        break

      case 'search':
        if (!query) return res.status(400).json({ error: 'Missing "query" for search' })
        result = await microlink.search(query)
        break

      case 'html':
        if (!url) return res.status(400).json({ error: 'Missing "url" for html' })
        result = await microlink.html(url, options)
        break

      case 'images':
        if (!url) return res.status(400).json({ error: 'Missing "url" for images' })
        result = await microlink.images(url, options)
        break

      case 'metadata':
        if (!url) return res.status(400).json({ error: 'Missing "url" for metadata' })
        result = await microlink.metadata(url, options)
        break

      default:
        return res.status(400).json({ error: `Unsupported type: ${type}` })
    }

    // 5. Return the successful result
    return res.status(200).json(result)

  } catch (error) {
    console.error('Microlink API Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
