import { useEffect, useState } from "react"
import axios from "axios"
import EnergyChart from "../modules/energy-dashboard/EnergyChart"
import ProfitChart from "../modules/energy-dashboard/ProfitChart"
import BatteryStatus from "../modules/energy-dashboard/BatteryStatus"
import EnergyFlow from "../modules/energy-dashboard/EnergyFlow"

export default function Dashboard() {
  const [data, setData] = useState([])
  const [soc, setSoc] = useState(0)
  const [solar, setSolar] = useState(0)
  const [grid, setGrid] = useState(0)
  const [load, setLoad] = useState(0)

  const totalProfit = data.reduce((acc, d) => acc + d.profit, 0).toFixed(2)

  useEffect(() => {
    axios.get("http://localhost:8000/simulation")
      .then(res => {
        const timeseries = res.data.timeseries.map((d, i) => ({
          hour: i,
          solar: res.data.solar[i],
          load: res.data.load[i],
          grid: res.data.grid[i],
          soc: res.data.soc[i],
          profit: res.data.profit ? res.data.profit[i] : 0
        }))
        setData(timeseries)
        setSoc(res.data.soc[0])
        setSolar(res.data.solar[0])
        setGrid(res.data.grid[0])
        setLoad(res.data.load[0])
      })
      .catch(err => console.error("API error:", err))
  }, [])

  return (
    <div className="p-10 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl mb-6">⚡ Energy Optimization Platform</h1>

      <EnergyFlow
        solar={solar}
        battery={soc}
        grid={grid}
        demand={load}
      />

      <div className="mt-8">
        <BatteryStatus soc={soc} />
      </div>

      <div className="mt-10">
        <h2>Energy Overview</h2>
        <EnergyChart data={data} />
      </div>

      <div className="mt-10">
        <h2>Profit (€)</h2>
        <h2>💰 Savings Today: €{totalProfit}</h2>
        <ProfitChart data={data} />
      </div>
    </div>
  )
}