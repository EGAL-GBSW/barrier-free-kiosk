import { useState } from "react"
import "./App.css"
import AppLayout from "./components/layout/AppLayout"
import PaymentResultPage from "./components/pages/PaymentResultPage"
import { createPaymentOrder } from "./api/client"
import { total } from "./components/menu/menuData"

const testMode = import.meta.env.VITE_CHECKOUT_MODE === "toss-test"

async function startTestPayment({ cart, orderType, widgets }) {
  const order = await createPaymentOrder(orderType, cart, total(cart))
  await widgets.requestPayment({
    orderId: order.orderId,
    orderName: order.orderName,
    successUrl: `${window.location.origin}/payment/success`,
    failUrl: `${window.location.origin}/payment/fail`,
  })
}

const isPaymentReturn = () =>
  /^\/payment\/(success|fail)\/?$/.test(window.location.pathname)

function App() {
  const [paymentReturn, setPaymentReturn] = useState(isPaymentReturn)
  const [page, setPage] = useState(paymentReturn ? "complete" : "start")
  const [step, setStep] = useState(paymentReturn ? 5 : 1)
  const [font, setFont] = useState(0)

  const goToStart = () => {
    if (paymentReturn) {
      window.history.replaceState(null, "", "/")
      setPaymentReturn(false)
    }
    setPage("start")
    setStep(1)
  }

  return (
    <AppLayout
      page={page}
      currentStep={step}
      font={font}
      onFont={setFont}
      onCheckout={testMode ? startTestPayment : undefined}
      completeSlot={
        paymentReturn ? <PaymentResultPage onDone={goToStart} /> : undefined
      }
      onHome={(action, mode) => {
        if (action === "DINE_IN" || action === "TAKEOUT") {
          setPage(mode === "voice" ? "voice" : "menu")
          setStep(2)
        } else if (action === "start") {
          goToStart()
        } else {
          setPage(page === "start" ? "menu" : "start")
          setStep(page === "start" ? 2 : 1)
        }
      }}
    />
  )
}

export default App
