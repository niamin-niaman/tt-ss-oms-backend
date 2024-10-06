import express from "express"
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";
import nodemailer from 'nodemailer';
import Bull, { Job } from 'bull';


const app = express();
app.use(bodyParser.json())

const prisma = new PrismaClient()

const checkQueue = new Bull("check", {
    redis: "default:Qrv0pEDSNKKzmWKnuCOS872zBHBtT7Jd@redis-11889.c252.ap-southeast-1-1.ec2.redns.redis-cloud.com:11889"
});

const check = async (randomId: any) => {
    checkQueue.add({ randomId })
}
const processCheck = async (job: Job) => {
    const { randomId } = job.data
    setTimeout(() => {
        console.log(`running ${randomId}`)
    }, 1000 * randomId)
}
checkQueue.process(processCheck);

app.get("/", async (req, res) => {

    console.log('good health , good life')

    const testDB = await prisma.test.findMany();

    console.log(testDB)

    res.json({
        "message": "OK !!",
        "db": testDB
    })

})

app.post("/check_email", async (req, res) => {

    const { to } = req.body

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
        subject: 'Hello World',
        html: '<strong>It works!</strong>',
    });

    console.log('info: ', info)

    res.json({
        "message": "ok",
        to
    })

})

app.get("/check_queue", async (req, res) => {

    const randomId = Math.floor(Math.random() * 10) + 1;
    console.log(`add queue check ${randomId}`)

    await check(randomId)

    res.json({
        "message": "queue ok"
    })
})

app.listen(4300, () => {
    console.log("Server started at http://localhost:4300");
});