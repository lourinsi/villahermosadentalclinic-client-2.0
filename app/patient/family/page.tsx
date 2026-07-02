"use client";

import { apiUrl } from "@/lib/api";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Patient } from "@/lib/patient-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, User as UserIcon, Search, Calendar, Pencil, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatTimeTo12h } from "@/lib/time-slots";
import { Appointment } from "@/hooks/useAppointments";
import { getAppointmentStatusBadgeClassName } from "@/lib/status-colors";
import { formatWordyDate } from "@/lib/utils";

const FamilyPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [familyMembers, setFamilyMembers] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<Patient | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewingAppointments, setIsViewingAppointments] = useState(false);
  const [memberAppointments, setMemberAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    relationship: "Family Member",
    dateOfBirth: "",
    alternatePhone: "",
    alternateEmail: "",
  });

  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    relationship: "",
    dateOfBirth: "",
    alternatePhone: "",
    alternateEmail: "",
  });

  const fetchFamilyMembers = useCallback(async () => {
    if (user?.patientId) {
      try {
        setIsLoading(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch(apiUrl(`/api/patients?parentId=${user.patientId}`), { 
          headers, 
          credentials: "include" 
        });
        const result = await response.json();
        if (result.success) {
          setFamilyMembers(result.data.filter((p: Patient) => p.id !== user.patientId));
        } else {
          toast.error(result.message || "Failed to fetch family members.");
        }
      } catch {
        toast.error("An error occurred while fetching family members.");
      } finally {
        setIsLoading(false);
      }
    }
  }, [user?.patientId]);

  const filteredMembers = useMemo(() => {
    return familyMembers.filter(member => 
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.relationship?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.alternatePhone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.alternateEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [familyMembers, searchTerm]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchFamilyMembers();
    }
  }, [user, authLoading, fetchFamilyMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.patientId) return;

    try {
      setIsAdding(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl("/api/patients/dependent"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...newMember,
          parentId: user.patientId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("Family member added successfully!");
        setNewMember({
          firstName: "",
          lastName: "",
          relationship: "Family Member",
          dateOfBirth: "",
          alternatePhone: "",
          alternateEmail: "",
        });
        fetchFamilyMembers();
      } else {
        toast.error(result.message || "Failed to add family member.");
      }
    } catch {
      toast.error("An error occurred while adding family member.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditClick = (member: Patient) => {
    setSelectedMember(member);
    setEditFormData({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      relationship: member.relationship || "",
      dateOfBirth: member.dateOfBirth || "",
      alternatePhone: member.alternatePhone || "",
      alternateEmail: member.alternateEmail || "",
    });
    setIsEditing(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/patients/${selectedMember.id}`), {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...editFormData,
          name: `${editFormData.firstName} ${editFormData.lastName}`.trim()
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("Family member updated successfully!");
        setIsEditing(false);
        fetchFamilyMembers();
      } else {
        toast.error(result.message || "Failed to update family member.");
      }
    } catch {
      toast.error("An error occurred while updating family member.");
    }
  };

  const fetchMemberAppointments = async (memberId: string) => {
    try {
      setIsLoadingAppointments(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/appointments?patientId=${memberId}`), { 
        headers, 
        credentials: "include" 
      });
      const result = await response.json();
      if (result.success) {
        setMemberAppointments(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch member appointments", error);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  const handleViewAppointments = (member: Patient) => {
    setSelectedMember(member);
    setIsViewingAppointments(true);
    fetchMemberAppointments(member.id!);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Family Members</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your family accounts and their appointments.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Family Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Family Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    required
                    value={newMember.firstName}
                    onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    required
                    value={newMember.lastName}
                    onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Input
                  id="relationship"
                  placeholder="e.g. Spouse, Child, Parent"
                  value={newMember.relationship}
                  onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={newMember.dateOfBirth}
                  onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Personal Phone</Label>
                  <Input
                    id="phone"
                    placeholder="Optional contact number"
                    value={newMember.alternatePhone}
                    onChange={(e) => setNewMember({ ...newMember, alternatePhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Personal Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Optional email"
                    value={newMember.alternateEmail}
                    onChange={(e) => setNewMember({ ...newMember, alternateEmail: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Email and main account number are inherited from your profile. Family members cannot use their personal number to login.
              </p>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isAdding}>
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search family members..." 
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No family members found.</p>
            {searchTerm && <Button variant="link" onClick={() => setSearchTerm("")}>Clear search</Button>}
          </div>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{member.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-600 border-blue-100 bg-blue-50/50">
                      {member.relationship}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleEditClick(member)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2 bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">DOB</span>
                    <span className="font-medium text-gray-900">{member.dateOfBirth || "Not specified"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900 truncate max-w-[150px]">{member.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-900">{member.phone}</span>
                  </div>
                  {member.alternateEmail && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-2">
                      <span className="text-gray-400 text-[11px] uppercase font-semibold">Personal Email</span>
                      <span className="font-medium text-gray-900 truncate max-w-[150px]">{member.alternateEmail}</span>
                    </div>
                  )}
                  {member.alternatePhone && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-gray-400 text-[11px] uppercase font-semibold">Personal Phone</span>
                      <span className="font-medium text-gray-900">{member.alternatePhone}</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-xs h-9 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                    onClick={() => handleViewAppointments(member)}
                  >
                    <Calendar className="w-3.5 h-3.5 mr-2" />
                    View Appointments
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Family Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateMember} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  required
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  required
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRelationship">Relationship</Label>
              <Input
                id="editRelationship"
                value={editFormData.relationship}
                onChange={(e) => setEditFormData({ ...editFormData, relationship: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDob">Date of Birth</Label>
              <Input
                id="editDob"
                type="date"
                value={editFormData.dateOfBirth}
                onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editPhone">Personal Phone</Label>
                <Input
                  id="editPhone"
                  value={editFormData.alternatePhone}
                  onChange={(e) => setEditFormData({ ...editFormData, alternatePhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Personal Email</Label>
                <Input
                  id="editEmail"
                  value={editFormData.alternateEmail}
                  onChange={(e) => setEditFormData({ ...editFormData, alternateEmail: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appointments Dialog */}
      <Dialog open={isViewingAppointments} onOpenChange={setIsViewingAppointments}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Appointments for {selectedMember?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {isLoadingAppointments ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                <p className="text-sm text-gray-500">Loading appointments...</p>
              </div>
            ) : memberAppointments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
                <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">No appointments found.</p>
                <p className="text-xs text-gray-400 mt-1">This member has no upcoming or past appointments.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {memberAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{formatWordyDate(apt.date, { fallback: apt.date || "No date" })}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-medium text-blue-600">{formatTimeTo12h(apt.time)}</span>
                          <span>•</span>
                          <span>Dr. {apt.doctor}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={`
                      uppercase text-[9px] font-black
                      ${getAppointmentStatusBadgeClassName(apt.status)}
                    `}>
                      {apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-6">
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setIsViewingAppointments(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FamilyPage;
