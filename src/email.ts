import nodemailer from 'nodemailer';

export async function sendEmail(to: string, subject: string, htmlContent: string){
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        secure: true,
        port: 465,
        auth: {
            user: 'resend',
            pass: process.env.RESEND_API_KEY,
        },
    });

    const info = await transporter.sendMail({
        from: 'oms.backend@niamin.dev',
        to: to,
        subject: subject,
        html: htmlContent,

    });

    console.log('info: ', info)

    
}