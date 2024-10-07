import { Or } from "@prisma/client/runtime/library";
import prisma from "./prisma"
import { decreseStockQuantity, findBestWareHouse } from "./warehouse";
import { addEmailQueue, addOrderQueue } from "./queue";


export type LineItem = {
    id: number;
    product: string;
    quantity: number
}

type Order = {
    id?: number;
    email: string;
    line_items: LineItem[]
    shipping_address: string,
    shipping_postcode: string

}

export async function receiveOrder(order: Order) {

    try {

        const orderCreated = await prisma.order.create({
            data: {
                email: order.email,
                shipping_address: order.shipping_address,
                shipping_postcode: order.shipping_postcode.toString(),
                status: "processing",
                line_item: {
                    create: order.line_items
                }
            }
        })

        console.log('add email to queue')
        await addEmailQueue(
            order.email,
            `ยืนยันคำสั่งซื้อ #${orderCreated.id} ของท่าน`,
            `ระบบของเราได้รับคำสั่งซื้อหมายเลข ${orderCreated.id} ของท่านเรียบร้อยแล้ว ระบบกำลังดำเนินการต่อไป`
        )

        console.log('add order to queue')
        await addOrderQueue(orderCreated.id)

        return {
            order: orderCreated,
        }

    } catch (error: any) {

        console.error(`Something Went Wrong! ${error.message}`)

        throw error


    }

}

export async function getOrder(id: number) {

    try {

        const order = await prisma.order.findFirst({
            where: {
                id: id
            },
            select: {
                id: true,
                email: true,
                shipping_address: true,
                shipping_postcode: true,
                status: true,
                line_item: {
                    select: {
                        id: true,
                        product: true,
                        quantity: true
                    }
                }
            }

        })

        const shippingWarehouse = await prisma.warehouse_shipping.findMany({
            where: {
                order_id: id
            },
            include: {
                // order: true,
                warehouse: true,
                stock: true
            }
        })

        const shippingTimeList = shippingWarehouse
            .map((warehouse) => warehouse.warehouse?.shipping_time)
            .filter((time): time is number => time !== undefined && time !== null);
        const estimateShippingTime = Math.max(...shippingTimeList)

        const priceList = shippingWarehouse
            .map((warehouse) => warehouse.stock?.price)
            .filter((price): price is number => price !== undefined && price !== null)

        const cost = priceList.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

        return {
            order,
            shippingWarehouse,
            cost,
            estimateShippingTime
        }

    } catch (error: any) {
        console.error(`Something Went Wrong!! ${error.message}`)
        throw error
    }

}

export async function getOrders() {
    try {

        const order = await prisma.order.findMany({
            select: {
                id: true,
                email: true,
                shipping_address: true,
                shipping_postcode: true,
                status: true,
                line_item: {
                    select: {
                        product: true,
                        quantity: true
                    }
                }
            }

        })

        return order

    } catch (error: any) {
        console.error(`Something Went Wrong!! ${error.message}`)
        throw error
    }
}

export async function processOrder(orderId: number) {

    const { order } = await getOrder(orderId)
    if (!order) throw new Error("Order not found")

    const lineItems = order.line_item as LineItem[]

    let lineItemWarehouses: any
    try {
        lineItemWarehouses = await findBestWareHouse(lineItems)
    } catch (error: any) {
        console.error(error.message)

        if (error.name == "STOCK_NOT_ENOUGH") {
            await prisma.order.update({
                where: {
                    id: orderId
                },
                data: {
                    status: "refund"
                }
            })

            addEmailQueue(
                order.email ?? "",
                `ยกเลิกสำหรับคำสั่งซื้อ #${orderId} ของคุณ`,
                `เรากำลังดำเนินการคืนเงินสำหรับคำสั่งซื้อหมายเลข ${orderId} ของคุณขออภัยในความไม่สะดวก <br> ${error.message}`

            )
        } else {
            console.error("Unexpected error:", error);
        }

        throw error

    }

    // return lineItemWarehouses

    // สรุปข้อมูลรายการและจำนวนที่ warehouse ต้องส่ง
    const shippingWarehouse = []
    for await (const lineItemWarehouse of lineItemWarehouses) {
        const list = lineItemWarehouse.selectedWarehouses.map((warehouse: any) => (
            {
                line_item_id: lineItemWarehouse.line_item_id,
                order_id: orderId,
                ...warehouse
            }))
        shippingWarehouse.push(...list)
    }

    const addShippingWarehouse = shippingWarehouse.map((warehouse) => {

        delete warehouse.product
        delete warehouse.price
        delete warehouse.warehouse
        delete warehouse.quantity
        delete warehouse.shipping_time

        return {
            ...warehouse
        }
    })

    for await (const shipping of addShippingWarehouse) {

        // บันทึกรายละเอียดการส่ง
        await prisma.warehouse_shipping.create({
            data: shipping
        })
        // ลดจำนวน stock
        await decreseStockQuantity(shipping.stock_id, shipping.needed_quantity)

    }

    await prisma.order.update({
        where: {
            id: orderId
        },
        data: {
            status: "shipping"
        }
    })

    const { estimateShippingTime } = await getOrder(orderId)

    addEmailQueue(
        order.email ?? "",
        `คำสั่งซื้อ #${orderId} ของคุณดำเนินการเสร็จสิ้น`,
        `คำสั่งซื้อหมายเลข ${orderId} ของท่านกำลังนำจัดส่ง คาดว่าจะได้รับภายใน ${estimateShippingTime} วัน`

    )

    return shippingWarehouse


}


export async function getShippingWarehouse(orderId: number) {

    const shippingWarehouse = await prisma.warehouse_shipping.findMany({
        where: {
            order_id: orderId
        },
        include: {
            // order: true,
            warehouse: true,
            stock: true
        }
    })

    const shippingTimeList = shippingWarehouse
        .map((warehouse) => warehouse.warehouse?.shipping_time)
        .filter((time): time is number => time !== undefined && time !== null);
    const estimateShippingTime = Math.max(...shippingTimeList)

    return shippingWarehouse
}