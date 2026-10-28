import { useState } from "react"
import "./App.css"
import AppLayout from "./components/layout/AppLayout"

function App() {
  const [page, setPage] = useState("menu")
  const [step, setStep] = useState(2)
  const [font, setFont] = useState(0)

  return (
    <AppLayout
      page={page}
      currentStep={step}
      font={font}
      onFont={setFont}
      onHome={(action) => {
        if (action === "DINE_IN" || action === "TAKEOUT") {
          setPage("menu")
          setStep(2)
        } else {
          setPage(page === "start" ? "menu" : "start")
          setStep(page === "start" ? 2 : 1)
        }
      }}
    />
  )
}

export default App
