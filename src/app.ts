import express from "express"
import bodyParser from "body-parser";
import nodemailer from 'nodemailer';
import Bull, { Job } from 'bull';
import prisma from "./prisma";
import { findBestWareHouse, getWareHouse } from "./warehouse";
import { getOrder, getOrders, getShippingWarehouse, processOrder, receiveOrder } from "./order";
import { addEmailQueue } from "./queue";

const app = express();
app.use(bodyParser.json())


const checkQueue = new Bull("check", {
    redis: process.env.REDIS_HOST
});

const check = async (randomId: any) => {
    checkQueue.add({ randomId })
}
const processCheck = async (job: Job) => {
    const { randomId } = job.data
    setTimeout(() => {
        console.log(`running ${randomId}`)
    }, 100 * randomId)
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

    // const transporter = nodemailer.createTransport({
    //     host: 'smtp.resend.com',
    //     secure: true,
    //     port: 465,
    //     auth: {
    //         user: 'resend',
    //         pass: process.env.RESEND_API_KEY,
    //     },
    // });

    // const info = await transporter.sendMail({
    //     from: 'oms.backend@niamin.dev',
    //     to: to,
    //     subject: 'Hello World',
    //     html: '<strong>It works!</strong>',
    // });

    // console.log('info: ', info)

    const queRes = await addEmailQueue( to, 'Hello World', '<strong>It works!</strong>')

    res.json({
        queRes,
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

// Orders

app.get("/orders/debug", async( req, res)=>{
    try {
        // const debugRes = await processOrder(2)
        const debugRes = await getShippingWarehouse(2)
        res.json({
            debugRes
        })
    } catch (error: any) {
        console.error(error.message)
        res
            .status(500)
            .json({
                message: error.message
            })
    }
})

app.get("/orders", async (req, res) => {
    try {
        const orders = await getOrders()
        res.json({
            orders
        })
    } catch (error: any) {
        res
            .status(500)
            .json({

                error,
                message: `Something Went Wrong! ${error.message}`
            })
    }
})

app.get("/orders/:id", async (req, res) => {
    try {
        const { id } = req.params
        const order = await getOrder(parseInt(id))
        res.json({
            id,
            order
        })
    } catch (error: any) {
        res
            .status(500)
            .json({

                error,
                message: `Something Went Wrong! ${error.message}`
            })
    }
})

app.post("/purchase", async (req, res) => {
    const body = req.body

    try {

        const receiveOrderRes = await receiveOrder(body)

        res.json({
            body,
            message: receiveOrderRes
        })

    } catch (error: any) {
        res
            .status(500)
            .json({
                error,
                message: `Something Went Wrong! ${error.message}`
            })
    }

})

// Warehouse

app.get("/warehouses/debug", async (req, res) => {
    try {

        const orderLineItems = [
            {
                "id": 1,
                "product": "mouse",
                "quantity": 2
            },
            {
                "id": 2,
                "product": "laptop",
                "quantity": 2
            },
            {
                "id": 3,
                "product": "keyboard",
                "quantity": 3
            }
        ]

        const debugRes = await findBestWareHouse(orderLineItems)
        res.json({
            debugRes
        })
    } catch (error: any) {
        res
            .status(500)
            .json({
                message: error.message
            })
    }
})

app.get("/warehouses/:id", async (req, res) => {
    const { id } = req.params

    console.log(`warehouse id: ${id}`)
    const warehouse = await getWareHouse(parseInt(id))

    res.json({
        id,
        warehouse
    })
})

app.listen(4300, () => {
    console.log("Server started at http://localhost:4300");
});