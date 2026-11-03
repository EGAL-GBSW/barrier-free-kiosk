import { useState } from "react"
import "./App.css"
import AppLayout from "./components/layout/AppLayout"

function App() {
  const [page, setPage] = useState("start")
  const [step, setStep] = useState(1)
  const [font, setFont] = useState(0)

  return (
    <AppLayout
      page={page}
      currentStep={step}
      font={font}
      onFont={setFont}
      onHome={(action, mode) => {
        if (action === "DINE_IN" || action === "TAKEOUT") {
          setPage(mode === "voice" ? "voice" : "menu")
          setStep(2)
        } else if (action === "start") {
          setPage("start")
          setStep(1)
        } else {
          setPage(page === "start" ? "menu" : "start")
          setStep(page === "start" ? 2 : 1)
        }
      }}
    />
  )
}

export default App
