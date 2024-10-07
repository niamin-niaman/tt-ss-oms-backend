import Bull, { Job } from 'bull';
import { processOrder } from './order';
import { sendEmail } from './email';

const orderQueue = new Bull("order", {
    redis: process.env.REDIS_HOST
});

const emailQueue = new Bull("email", {
    redis: process.env.REDIS_HOST
});


export async function addOrderQueue(orderId: number){
    return await orderQueue.add({ orderId })
}

async function processOrderQueue(job: Job){
    
    const { orderId } = job.data
    console.log(`Order ${orderId} queue on working ...`)
    await processOrder(orderId)
}
orderQueue.process(processOrderQueue)

export async function addEmailQueue(to: string, subject: string, htmlContent: string){
    console.log('add email to queue')
    return await emailQueue.add({
        to, subject, htmlContent
    })
}

async function processEmailQueue(job: Job){
    const { to, subject, htmlContent } = job.data
    console.log(`Email ${to} : ${subject} queue on working ...`)
    await sendEmail(to, subject, htmlContent)
}
emailQueue.process(processEmailQueue)