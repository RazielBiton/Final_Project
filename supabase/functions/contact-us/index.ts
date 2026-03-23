import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// הגדרות CORS כדי לאפשר לאתר שלך לתקשר עם הפונקציה
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // טיפול בבקשות Preflight (דפדפנים שולחים OPTIONS לפני POST)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // קבלת הנתונים מהטופס באתר
    const { name, email, message } = await req.json()

    // שליחת המייל דרך ה-API של Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'EasyCare Leads <onboarding@resend.dev>', // כאן שמים את המייל המאומת שלך ב-Resend
        to: ['[EMAIL_ADDRESS]'], // המייל שאליו הלידים יישלחו
        subject: `New message from ${name} by easycare contact-us`,
        html: `
          <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background-color: #ffffff;">
            
            <div style="background-color: #007bff; color: white; padding: 25px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 600;">התקבלה פנייה חדשה באתר</h2>
              <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">EasyCare - Lead Management System</p>
            </div>

            <div style="padding: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #666; width: 35%;"><strong>שם הלקוח:</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #333; font-weight: 500;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #666;"><strong>אימייל לחזרה:</strong></td>
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
                    <a href="mailto:${email}" style="color: #007bff; text-decoration: none; font-weight: 500;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 20px 12px 10px 12px; color: #666;"><strong>תוכן ההודעה:</strong></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 15px; color: #444; line-height: 1.6; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
                    ${message.replace(/\n/g, '<br>')}
                  </td>
                </tr>
              </table>
            </div>

            <div style="padding: 25px; background-color: #fdfdfd; text-align: center; border-top: 1px solid #f0f0f0;">
              <a href="mailto:${email}" style="background-color: #28a745; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">השב ללקוח במייל</a>
              <div style="margin-top: 20px; font-size: 12px; color: #999;">
                <p style="margin: 0;">נשלח באופן אוטומטי דרך EasyCare Edge Functions</p>
                <p style="margin: 5px 0 0 0;">${new Date().toLocaleString('he-IL')}</p>
              </div>
            </div>

          </div>
        `,
      }),
    })

    const responseData = await res.json()

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})