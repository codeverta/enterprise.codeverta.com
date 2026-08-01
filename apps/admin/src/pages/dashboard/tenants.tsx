import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import api from "../../lib/api"
import DashboardLayout from "../../layout/DashboardLayout"
import { toast } from "sonner"

// Tipe Data
interface Tenant {
  id: string
  name: string
  domain: string
  is_active: boolean
}

export function TenantPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({ name: "", domain: "", is_active: true })
  const [editingId, setEditingId] = useState<string | null>(null)

  // Fetch Data
  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants')
      setTenants(res.data)
    } catch (error) {
      console.error("Failed to fetch", error)
    }
  }

  useEffect(() => { fetchTenants() }, [])

  // Handle Submit (Create/Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/tenants/${editingId}`, formData)
      } else {
        await api.post('/tenants', formData)
      }
      setIsOpen(false)
      resetForm()
      fetchTenants()
    } catch (error) {
      alert("Error saving data")
    }
  }

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Hapus tenant ini?")) return
    await api.delete(`tenants/${id}`)
    fetchTenants()
  }

  // Helper
  const openEdit = (t: Tenant) => {
    setEditingId(t.id)
    setFormData({ name: t.name, domain: t.domain, is_active: t.is_active })
    setIsOpen(true)
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({ name: "", domain: "", is_active: true })
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tenant Management</h1>
        
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) resetForm() }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Tenant" : "New Tenant"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label>Name</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div>
                <Label>Domain</Label>
                <Input 
                  value={formData.domain} 
                  onChange={e => setFormData({...formData, domain: e.target.value})} 
                  required 
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={c => setFormData({...formData, is_active: c})} 
                />
                <Label>Active Status</Label>
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] break-all bg-muted p-1 rounded">
                            {t.id}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                t.id || ""
                              );
                              toast.success("Tenant ID disalin");
                            }}
                          >
                            <Copy className="h-2 w-2" />
                          </Button>
                        </div>
                </TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.domain}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default DashboardLayout(TenantPage)
