import { useState, useEffect } from "react"
import axios from "axios"

export default function Sites() {
  const [sites, setSites] = useState([])
  const [form, setForm] = useState({
    name: "", location: "", lat: "", lng: "",
    solar_kw: "", battery_kwh: "", ev_chargers: "",
    owner: "Francisco Morais", status: "active"
  })

  const loadSites = () => {
    axios.get("http://localhost:8000/api/sites")
      .then(res => setSites(res.data))
  }

  useEffect(() => { loadSites() }, [])

  const handleSubmit = () => {
    axios.post("http://localhost:8000/api/sites", {
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      solar_kw: parseFloat(form.solar_kw),
      battery_kwh: parseFloat(form.battery_kwh),
      ev_chargers: parseInt(form.ev_chargers),
    }).then(() => { loadSites(); })
  }

  const deleteSite = (id) => {
    axios.delete(`http://localhost:8000/api/sites/${id}`)
      .then(() => loadSites())
  }

  return (
    <div className="p-10 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl mb-8">🗺️ Gestão de Sites</h1>

      {/* Formulário */}
      <div className="bg-gray-800 p-6 rounded-xl mb-10 grid grid-cols-2 gap-4">
        <h2 className="col-span-2 text-xl mb-2">➕ Novo Site</h2>
        {[
          ["name", "Nome da instalação"],
          ["location", "Localização (cidade)"],
          ["lat", "Latitude"],
          ["lng", "Longitude"],
          ["solar_kw", "Solar (kW)"],
          ["battery_kwh", "Bateria (kWh)"],
          ["ev_chargers", "Carregadores EV"],
          ["owner", "Proprietário"],
        ].map(([field, label]) => (
          <input
            key={field}
            placeholder={label}
            value={form[field]}
            onChange={e => setForm({ ...form, [field]: e.target.value })}
            className="bg-gray-700 p-3 rounded-lg text-white placeholder-gray-400"
          />
        ))}
        <button
          onClick={handleSubmit}
          className="col-span-2 bg-green-600 hover:bg-green-500 p-3 rounded-lg font-bold mt-2"
        >
          Guardar Site
        </button>
      </div>

      {/* Lista de sites */}
      <div className="grid grid-cols-1 gap-4">
        {sites.length === 0 && (
          <p className="text-gray-400">Nenhum site adicionado ainda.</p>
        )}
        {sites.map(site => (
          <div key={site.id} className="bg-gray-800 p-5 rounded-xl flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">{site.name}</h3>
              <p className="text-gray-400">{site.location} · {site.solar_kw} kW solar · {site.battery_kwh} kWh bateria · {site.ev_chargers} EV</p>
            </div>
            <button
              onClick={() => deleteSite(site.id)}
              className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-lg"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}