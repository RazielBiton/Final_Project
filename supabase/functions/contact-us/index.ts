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
        from: 'EasyCare Leads <onboarding@resend.dev>', // חשוב: ב-Resend אפשר לשלוח רק מהכתובת המאומתת!
        to: ['easycare.support@gmail.com'], // הכתובת אליה המייל יגיע! תוקן בהצלחה.
        subject: `[פנייה חדשה] - הודעה מאת ${name} (EasyCare)`,
        html: `
          <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 40px 20px; text-align: right;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 4px solid #3b82f6;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">התקבלה פנייה חדשה</h1>
                <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 16px;">מערכת ניהול לקוחות - EasyCare</p>
              </div>

              <!-- Body -->
              <div style="padding: 40px 30px;">
                
                <p style="font-size: 16px; color: #475569; margin-bottom: 25px; line-height: 1.6;">
                  שלום צוות EasyCare,<br>
                  התקבלה פנייה חדשה מאתר האינטרנט. להלן פרטי הלקוח ותוכן הפנייה:
                </p>

                <!-- Details Card -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                  <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">פרטי הלקוח</h3>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; color: #64748b; width: 35%; font-size: 15px;"><strong>שם מלא:</strong></td>
                      <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 16px;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #64748b; font-size: 15px;"><strong>כתובת אימייל:</strong></td>
                      <td style="padding: 10px 0;">
                        <a href="mailto:${email}" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 16px;">${email}</a>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Message Content -->
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">תוכן ההודעה</h3>
                <div style="background-color: #ffffff; border-right: 4px solid #3b82f6; border-left: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; color: #334155; line-height: 1.8; font-size: 16px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                  ${message.replace(/\n/g, '<br>')}
                </div>

              </div>

              <!-- Footer -->
              <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <a href="mailto:${email}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.25); transition: all 0.3s ease;">
                  השב ללקוח עכשיו
                </a>
                <p style="margin: 25px 0 0 0; font-size: 13px; color: #94a3b8;">
                  הודעה זו נשלחה אוטומטית על ידי שרתי EasyCare.<br>
                  ${new Date().toLocaleString('he-IL')}
                </p>
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