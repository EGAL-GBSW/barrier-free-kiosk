export default function toReceipt(order) {
    return {
        number: order.orderId,
        items: order.items,
        total: order.totalPrice,
        type: order.orderType,
        approved: order.status === "PAID",
    }
}
