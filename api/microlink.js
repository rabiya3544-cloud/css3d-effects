// api/microlink.js
import createClient from 'microlink.io'

export default async function handler(request, response) {
  // Basic security: Ensure it's a POST request
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  // Initialize the client. 
  // It works without a key on the free plan.
  // For production, add MICROLINK_API_KEY to Vercel Environment Variables.
  const microlink = createClient({
    apiKey: process.env.MICROLINK_API_KEY 
  })

  try {
    const { url } = request.body
    if (!url) {
      return response.status(400).json({ error: 'URL is required' })
    }

    // Example: Get metadata. You can also use microlink.screenshot(url), etc.
    const data = await microlink.metadata(url)
    
    return response.status(200).json(data)
  } catch (error) {
    return response.status(500).json({ error: error.message })
  }
}
