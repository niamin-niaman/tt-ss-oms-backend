import e from "express";
import prisma from "./prisma";
import * as _ from "lodash"
import { LineItem } from "./order";

export async function getWareHouse(id: number) {

    try {

        const stock = await prisma.warehouse.findFirst({
            where: {
                id: id
            },
            include: {
                stock: true
            }
        })

        return stock

    } catch (error: any) {

        console.error(`Something Went Wrong!! ${error.message}`)

        throw error

    }
}

// ดึงรายการ warehouses ทั้งหมด ตาม product , หา warehouse ที่ดีทีุ่ด ในแต่ละ line items
export async function findBestWareHouse(orderLineItems: LineItem[]) {

    // const orderLineItems = [
    //     {
    //         "product": "mouse",
    //         "quantity": 2
    //     },
    //     {
    //         "product": "laptop",
    //         "quantity": 2
    //     },
    //     {
    //         "product": "keyboard",
    //         "quantity": 3
    //     }
    // ]

    const stockWarehouses = []
    const warehouses = []
    for await (const orderLineItem of orderLineItems) {
        const stockWarehouse = await getStockWarehouses(orderLineItem)

        // เอา product มาต่อกัน
        stockWarehouses.push(stockWarehouse)
        // เอา availalbe warehouse ของทุก product มาต่อกัน
        warehouses.push(...stockWarehouse.availabeWarehouses)
    }

    const groupWh = _.groupBy(warehouses, 'warehouse')

    // เลือก warehouse ที่มีสินค้าครบทุกชิ้น
    let selectedWareshouseKey = ""
    let maxNumberItems = 0;
    for (const [warehouseKey, warehouseItems] of Object.entries(groupWh)) {
        if (warehouseItems.length > maxNumberItems) {
            selectedWareshouseKey = warehouseKey
            maxNumberItems = warehouseItems.length
        }
    }

    const bestWareHouse = stockWarehouses.map((stock) => {

        let selectedWarehouses: any = stock.selectedWarehouses

        let filteredWarehouse = stock.availabeWarehouses.filter((i: any) => i.warehouse == selectedWareshouseKey) || []

        if (filteredWarehouse.length > 0) {
            selectedWarehouses = filteredWarehouse
        } else if (selectedWarehouses.length == 0) {
            selectedWarehouses.push(stock.availabeWarehouses[0])
        }

        return {
            ...stock,
            availabeWarehouses: [],
            selectedWarehouses: selectedWarehouses
        }
    })

    return bestWareHouse

}



async function getStockWarehouses(orderLineItem: LineItem) {

    try {

        const stocks = await prisma.stock.findMany({
            where: {
                product: orderLineItem.product,
                quantity: {
                    gt: 0
                }
            },
            include: {
                warehouse: true
            },
        })

        if (stocks.length == 0) {
            const invalidStockError = new Error(`Stock for product ${orderLineItem.product} is not enough`)
            invalidStockError.name = 'STOCK_NOT_ENOUGH'
            throw invalidStockError
        }

        const stockWarehouses = stocks.map((stock) => {
            return {
                stock_id: stock.id,
                product: stock.product,
                warehouse: stock.warehouse?.name,
                warehouse_id: stock.warehouse?.id,
                // location_post: stock.warehouse?.location_postcode,
                price: stock.price,
                // cutoff_time: stock.warehouse?.cutoff_time,
                shipping_time: stock.warehouse?.shipping_time,
                quantity: stock.quantity,
                needed_quantity: orderLineItem.quantity
            }
        })

        // console.log(mappedStock)
        // return mappedStock


        // line item computer
        // const line_item = {
        //     "product": "laptop",
        //     "warehouses": [
        //         {
        //             "warehouse": "WH1",
        //             "location_post": "10000",
        //             "price": 25000,
        //             "cutoff_time": 9,
        //             "quatity": 1
        //         },
        //         {
        //             "warehouse": "WH2",
        //             "location_post": "20000",
        //             "price": 2000,
        //             "cutoff_time": 10,
        //             "quatity": 2
        //         }
        //     ]
        // }


        // check available stock
        // ตรวจสอบว่า warhose อะไรที่เพียงพอต่อ stock . ตัด warehouse ที่ ปริมาณ stock น้อยกว่า order
        let availableStockWarehouses = stockWarehouses.filter((stock) => (stock.quantity ?? 0) >= orderLineItem.quantity)

        let selectedWarehouses = []
        // ในกรณีที่ warehouse ไม่เพียงพอ ต้องปริมาณ ใน order
        if (availableStockWarehouses.length == 0) {

            // เรียงลำดับ warehouse ที่ดีสุด 1. มีของครบ 2. ราคา ถูกที่สุด 3. ระยะเวลาเร็วที่สุด
            const sortedStockWarehouses = _.orderBy(stockWarehouses, ["quatity", "price", "shipping_time"], ["desc", "asc", "asc"])
            // นำของทุก warehose ว่าตรวจสอบว่าเพียงพอหรือป่าว ? 
            let needStock = orderLineItem.quantity;
            for (const stock of sortedStockWarehouses) {
                selectedWarehouses.push(
                    {
                        ...stock,
                        // ปริมาณที่ต้องการสำหรับ warehouse นี้
                        needed_quantity: needStock < (stock.quantity ?? 0) ? needStock : stock.quantity
                    }
                )
                needStock -= stock.quantity ?? 0;
                if (needStock <= 0) break;
            }
            if (needStock > 0) {
                const invalidStockError = new Error(`Stock for product ${orderLineItem.product} is not enough`)
                invalidStockError.name = 'STOCK_NOT_ENOUGH'
                throw invalidStockError
            }

            availableStockWarehouses = []

        }


        const warehoseStock = {
            line_item_id: orderLineItem.id,
            product: orderLineItem.product,
            needed_quantity: orderLineItem.quantity,
            // warehouse ที่สามารถเป็นตัวเลือกได้
            availabeWarehouses: availableStockWarehouses,
            // warehouse ที่จำเป็นต้องเลือก
            selectedWarehouses: selectedWarehouses
        }

        return warehoseStock

    } catch (error: any) {

        console.error(error.message)
        throw error

    }
}


export async function decreseStockQuantity(stock_id: number, needed_quantity: number) {

    await prisma.stock.update({
        where: {
            id: stock_id
        },
        data: {
            quantity: {
                decrement: needed_quantity
            }
        }
    })
}