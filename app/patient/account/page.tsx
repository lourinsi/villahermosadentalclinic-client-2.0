"use client";

import { apiUrl } from "@/lib/api";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Patient } from "@/lib/patient-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, User, FileText, CheckCircle, Save } from "lucide-react";

const AccountPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedData = useRef<string>("");

  useEffect(() => {
    const fetchPatientData = async () => {
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
          
          const response = await fetch(apiUrl(`/api/patients/${user.patientId}`), { 
            headers, 
            credentials: "include" 
          });
          const result = await response.json();
          if (result.success) {
            setPatient(result.data);
            setTermsAccepted(result.data.termsAccepted || false);
            lastSavedData.current = JSON.stringify(result.data);
          } else {
            setError(result.message || "Failed to fetch patient data.");
            toast.error(result.message || "Failed to fetch patient data.");
          }
        } catch {
          setError("An error occurred while fetching patient data.");
          toast.error("An error occurred while fetching patient data.");
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (!authLoading && user) {
      fetchPatientData();
    }
  }, [user, authLoading]);

  const fetchQuestionnaireData = async () => {
    if (user?.patientId) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch(apiUrl(`/api/questionnaires/${user.patientId}`), { 
          headers, 
          credentials: "include" 
        });
        const result = await response.json();
        if (result.success && result.data) {
          setQuestionnaire(result.data);
          // Update patient state with questionnaire data
          setPatient(prev => {
            const updated = prev ? { ...prev, ...result.data } as any : null;
            lastSavedData.current = JSON.stringify(updated);
            return updated;
          });
        }
      } catch (err) {
        console.error("Error fetching questionnaire:", err);
      }
    }
  };

  const handleUpdate = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!patient) return;

    // Only send fields that actually exist on the current patient object
    // This avoids sending undefined fields that the backend doesn't expect
    const updateData: any = {};
    
    // Only include fields that have values
    if (patient.firstName !== undefined) updateData.firstName = patient.firstName;
    if (patient.lastName !== undefined) updateData.lastName = patient.lastName;
    if (patient.email !== undefined) updateData.email = patient.email;
    if (patient.phone !== undefined) updateData.phone = patient.phone;
    if (patient.dateOfBirth !== undefined) updateData.dateOfBirth = patient.dateOfBirth;
    if (patient.address !== undefined) updateData.address = patient.address;
    if (patient.name !== undefined) updateData.name = patient.name;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/patients/${patient.id}`), {
        method: 'PUT',
        headers,
        credentials: "include",
        body: JSON.stringify(updateData),
      });
      const result = await response.json();
      if (result.success) {
        if (e) toast.success("Account details updated successfully!");
        lastSavedData.current = JSON.stringify(patient);
      } else {
        if (e) toast.error(result.message || "Failed to update account details.");
      }
    } catch {
      if (e) toast.error("An error occurred while updating account details.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;

    if (!patient) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/patients/${patient.id}/change-password`), {
        method: 'POST',
        headers,
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Password changed successfully!");
        e.currentTarget.reset();
      } else {
        toast.error(result.message || "Failed to change password.");
      }
    } catch {
      toast.error("An error occurred while changing password.");
    }
  };

  const handleAcceptTerms = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!patient) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/patients/${patient.id}`), {
        method: 'PUT',
        headers,
        credentials: "include",
        body: JSON.stringify({ termsAccepted }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Terms and conditions accepted successfully!");
      } else {
        toast.error(result.message || "Failed to accept terms.");
      }
    } catch {
      toast.error("An error occurred while accepting terms.");
    }
  };

  const handleQuestionnaireUpdate = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!patient) return;

    setIsSaving(true);
    // Build questionnaire data from current patient state
    const questionnaireData: any = {};
    
    // General Information
    if ((patient as any).gender) questionnaireData.gender = (patient as any).gender;
    if ((patient as any).civilStatus) questionnaireData.civilStatus = (patient as any).civilStatus;
    if ((patient as any).age) questionnaireData.age = (patient as any).age;
    if ((patient as any).ethnicity) questionnaireData.ethnicity = (patient as any).ethnicity;
    if ((patient as any).religion) questionnaireData.religion = (patient as any).religion;
    if ((patient as any).nationality) questionnaireData.nationality = (patient as any).nationality;
    
    // Current Address
    if ((patient as any).currentStreet) questionnaireData.currentStreet = (patient as any).currentStreet;
    if ((patient as any).currentBarangay) questionnaireData.currentBarangay = (patient as any).currentBarangay;
    if ((patient as any).currentCity) questionnaireData.currentCity = (patient as any).currentCity;
    if ((patient as any).currentProvince) questionnaireData.currentProvince = (patient as any).currentProvince;
    if ((patient as any).currentZipCode) questionnaireData.currentZipCode = (patient as any).currentZipCode;
    
    // Permanent Address
    if ((patient as any).permanentStreet) questionnaireData.permanentStreet = (patient as any).permanentStreet;
    if ((patient as any).permanentBarangay) questionnaireData.permanentBarangay = (patient as any).permanentBarangay;
    if ((patient as any).permanentCity) questionnaireData.permanentCity = (patient as any).permanentCity;
    if ((patient as any).permanentProvince) questionnaireData.permanentProvince = (patient as any).permanentProvince;
    if ((patient as any).permanentZipCode) questionnaireData.permanentZipCode = (patient as any).permanentZipCode;
    
    // Contact Information
    if ((patient as any).landline) questionnaireData.landline = (patient as any).landline;
    if ((patient as any).mobileContact) questionnaireData.mobileContact = (patient as any).mobileContact;
    if ((patient as any).emailAddress) questionnaireData.emailAddress = (patient as any).emailAddress;
    
    // Emergency Contact
    if ((patient as any).emergencyFirstName) questionnaireData.emergencyFirstName = (patient as any).emergencyFirstName;
    if ((patient as any).emergencyLastName) questionnaireData.emergencyLastName = (patient as any).emergencyLastName;
    if ((patient as any).emergencyRelationship) questionnaireData.emergencyRelationship = (patient as any).emergencyRelationship;
    
    // Other Information
    if ((patient as any).education) questionnaireData.education = (patient as any).education;
    if ((patient as any).occupation) questionnaireData.occupation = (patient as any).occupation;
    if ((patient as any).company) questionnaireData.company = (patient as any).company;
    if ((patient as any).companyAddress) questionnaireData.companyAddress = (patient as any).companyAddress;
    if ((patient as any).height) questionnaireData.height = (patient as any).height;
    if ((patient as any).weight) questionnaireData.weight = (patient as any).weight;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("authToken") : null;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(`/api/questionnaires/${patient.id}`), {
        method: 'PUT',
        headers,
        credentials: "include",
        body: JSON.stringify(questionnaireData),
      });
      const result = await response.json();
      if (result.success) {
        if (e) toast.success("Questionnaire information saved successfully!");
        lastSavedData.current = JSON.stringify(patient);
      } else {
        if (e) toast.error(result.message || "Failed to save questionnaire.");
      }
    } catch {
      if (e) toast.error("An error occurred while saving questionnaire.");
    } finally {
      setIsSaving(false);
    }
  };

  // Autosave logic
  useEffect(() => {
    if (activeTab !== "questionnaire" || !patient) return;

    const currentData = JSON.stringify(patient);
    if (currentData === lastSavedData.current) return;

    const timer = setTimeout(() => {
      handleQuestionnaireUpdate();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [patient, activeTab]);

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!patient) {
    return <div className="p-4">No patient data found.</div>;
  }

  // Cast patient to allow additional questionnaire fields
  const patientData = patient as any;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">My Account</h1>

      {/* Tab Navigation */}
      <div className="flex gap-0 border-b-2 border-gray-200 bg-white rounded-t-lg">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 px-6 py-4 font-semibold border-b-4 transition-all ${
            activeTab === "personal"
              ? "border-blue-600 text-blue-600 bg-blue-50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <User className="h-5 w-5" />
          Personal Information
        </button>
        <button
          onClick={() => {
            setActiveTab("questionnaire");
            fetchQuestionnaireData();
          }}
          className={`flex items-center gap-2 px-6 py-4 font-semibold border-b-4 transition-all ${
            activeTab === "questionnaire"
              ? "border-blue-600 text-blue-600 bg-blue-50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <FileText className="h-5 w-5" />
          Health Info
        </button>
        <button
          onClick={() => setActiveTab("terms")}
          className={`flex items-center gap-2 px-6 py-4 font-semibold border-b-4 transition-all ${
            activeTab === "terms"
              ? "border-blue-600 text-blue-600 bg-blue-50"
              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <CheckCircle className="h-5 w-5" />
          Terms & Conditions
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "personal" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        disabled
                        value={patient.firstName || ''}
                      />
                      <p className="text-xs text-gray-500">Read-only. Request changes via support.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        disabled
                        value={patient.lastName || ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        disabled
                        value={patient.email || ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        disabled
                        value={patient.phone || ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        disabled
                        value={patient.dateOfBirth?.split('T')[0] || ''}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentCity">Current Address</Label>
                      <Input
                        id="currentCity"
                        disabled
                        value={patientData.currentCity || patient.city || ''}
                      />
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email & Password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input 
                      name="currentPassword" 
                      id="currentPassword" 
                      type="password" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input 
                      name="newPassword" 
                      id="newPassword" 
                      type="password" 
                      required 
                    />
                  </div>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Change Password</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "questionnaire" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between sticky top-0 z-20 bg-gray-50/80 backdrop-blur-sm py-4 -mt-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">Health Information</h2>
                {isSaving && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>
              <Button 
                onClick={() => handleQuestionnaireUpdate({ preventDefault: () => {} } as any)} 
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 shadow-md flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save All Changes
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={patient.firstName || ''}
                      onChange={(e) => setPatient({ ...patient, firstName: e.target.value, name: `${e.target.value} ${patient.lastName || ''}` })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={patient.lastName || ''}
                      onChange={(e) => setPatient({ ...patient, lastName: e.target.value, name: `${patient.firstName || ''} ${e.target.value}` })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={patient.email || ''}
                      onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={patient.phone || ''}
                      onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={patient.dateOfBirth?.split('T')[0] || ''}
                      onChange={(e) => setPatient({ ...patient, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Row */}
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      value={patientData.gender || ''}
                      onChange={(e) => setPatient({ ...patient, gender: e.target.value } as any)}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="civilStatus">Civil Status</Label>
                    <select
                      id="civilStatus"
                      value={patientData.civilStatus || ''}
                      onChange={(e) => setPatient({ ...patient, civilStatus: e.target.value } as any)}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                    >
                      <option value="">Select Civil Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>

                  {/* Age, Ethnicity, etc */}
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="Enter age"
                      value={patientData.age || ''}
                      onChange={(e) => setPatient({ ...patient, age: parseInt(e.target.value) || 0 } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ethnicity">Ethnicity</Label>
                    <Input
                      id="ethnicity"
                      placeholder="e.g., Filipino"
                      value={patientData.ethnicity || ''}
                      onChange={(e) => setPatient({ ...patient, ethnicity: e.target.value } as any)}
                    />
                  </div>

                  {/* Religion, Nationality */}
                  <div className="space-y-2">
                    <Label htmlFor="religion">Religion</Label>
                    <Input
                      id="religion"
                      placeholder="e.g., Roman Catholic"
                      value={patientData.religion || ''}
                      onChange={(e) => setPatient({ ...patient, religion: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input
                      id="nationality"
                      placeholder="e.g., Filipino"
                      value={patientData.nationality || ''}
                      onChange={(e) => setPatient({ ...patient, nationality: e.target.value } as any)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentStreet">No. & Street</Label>
                    <Input
                      id="currentStreet"
                      placeholder="Enter street address"
                      value={patientData.currentStreet || ''}
                      onChange={(e) => setPatient({ ...patient, currentStreet: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentBarangay">Barangay</Label>
                    <Input
                      id="currentBarangay"
                      placeholder="Enter barangay"
                      value={patientData.currentBarangay || ''}
                      onChange={(e) => setPatient({ ...patient, currentBarangay: e.target.value } as any)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentCity">City/Municipality</Label>
                      <Input
                        id="currentCity"
                        placeholder="Enter city"
                        value={patientData.currentCity || ''}
                        onChange={(e) => setPatient({ ...patient, currentCity: e.target.value } as any)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentProvince">Province</Label>
                      <Input
                        id="currentProvince"
                        placeholder="Enter province"
                        value={patientData.currentProvince || ''}
                        onChange={(e) => setPatient({ ...patient, currentProvince: e.target.value } as any)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentZipCode">Zip Code</Label>
                      <Input
                        id="currentZipCode"
                        placeholder="Enter zip code"
                        value={patientData.currentZipCode || ''}
                        onChange={(e) => setPatient({ ...patient, currentZipCode: e.target.value } as any)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permanent Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="permanentStreet">No. & Street</Label>
                    <Input
                      id="permanentStreet"
                      placeholder="Enter street address"
                      value={patientData.permanentStreet || ''}
                      onChange={(e) => setPatient({ ...patient, permanentStreet: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permanentBarangay">Barangay</Label>
                    <Input
                      id="permanentBarangay"
                      placeholder="Enter barangay"
                      value={patientData.permanentBarangay || ''}
                      onChange={(e) => setPatient({ ...patient, permanentBarangay: e.target.value } as any)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="permanentCity">City/Municipality</Label>
                      <Input
                        id="permanentCity"
                        placeholder="Enter city"
                        value={patientData.permanentCity || ''}
                        onChange={(e) => setPatient({ ...patient, permanentCity: e.target.value } as any)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permanentProvince">Province</Label>
                      <Input
                        id="permanentProvince"
                        placeholder="Enter province"
                        value={patientData.permanentProvince || ''}
                        onChange={(e) => setPatient({ ...patient, permanentProvince: e.target.value } as any)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permanentZipCode">Zip Code</Label>
                      <Input
                        id="permanentZipCode"
                        placeholder="Enter zip code"
                        value={patientData.permanentZipCode || ''}
                        onChange={(e) => setPatient({ ...patient, permanentZipCode: e.target.value } as any)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="landline">Landline Number</Label>
                      <Input
                        id="landline"
                        placeholder="Enter landline"
                        value={patientData.landline || ''}
                        onChange={(e) => setPatient({ ...patient, landline: e.target.value } as any)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobileContact">Mobile Number</Label>
                      <Input
                        id="mobileContact"
                        placeholder="Enter mobile number"
                        value={patientData.mobileContact || ''}
                        onChange={(e) => setPatient({ ...patient, mobileContact: e.target.value } as any)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailAddress">Email Address</Label>
                    <Input
                      id="emailAddress"
                      type="email"
                      placeholder="Enter email"
                      value={patientData.emailAddress || ''}
                      onChange={(e) => setPatient({ ...patient, emailAddress: e.target.value } as any)}
                    />
                  </div>
                  <p className="text-xs text-gray-500">In case the patient is a minor, contact dentist's email should be of the parents.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Person In Case of Emergency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyFirstName">First Name</Label>
                      <Input
                        id="emergencyFirstName"
                        placeholder="Enter first name"
                        value={patientData.emergencyFirstName || ''}
                        onChange={(e) => setPatient({ ...patient, emergencyFirstName: e.target.value } as any)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyLastName">Last Name</Label>
                      <Input
                        id="emergencyLastName"
                        placeholder="Enter last name"
                        value={patientData.emergencyLastName || ''}
                        onChange={(e) => setPatient({ ...patient, emergencyLastName: e.target.value } as any)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyRelationship">Relationship</Label>
                    <Input
                      id="emergencyRelationship"
                      placeholder="e.g., Spouse, Parent, Sibling"
                      value={patientData.emergencyRelationship || ''}
                      onChange={(e) => setPatient({ ...patient, emergencyRelationship: e.target.value } as any)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="education">Highest Educational Attainment *</Label>
                    <Input
                      id="education"
                      placeholder="e.g., College Undergrad"
                      value={patientData.education || ''}
                      onChange={(e) => setPatient({ ...patient, education: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation *</Label>
                    <Input
                      id="occupation"
                      placeholder="e.g., Self-employed"
                      value={patientData.occupation || ''}
                      onChange={(e) => setPatient({ ...patient, occupation: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company *</Label>
                    <Input
                      id="company"
                      placeholder="e.g., Company Name"
                      value={patientData.company || ''}
                      onChange={(e) => setPatient({ ...patient, company: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Company Address and Contact Details</Label>
                    <Input
                      id="companyAddress"
                      placeholder="Enter company address"
                      value={patientData.companyAddress || ''}
                      onChange={(e) => setPatient({ ...patient, companyAddress: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height *</Label>
                    <Input
                      id="height"
                      placeholder="e.g., 1.68"
                      value={patientData.height || ''}
                      onChange={(e) => setPatient({ ...patient, height: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight *</Label>
                    <Input
                      id="weight"
                      placeholder="e.g., 73"
                      value={patientData.weight || ''}
                      onChange={(e) => setPatient({ ...patient, weight: e.target.value } as any)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={() => handleQuestionnaireUpdate({ preventDefault: () => {} } as any)} 
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 shadow-lg px-8 py-6 text-lg font-bold rounded-2xl flex items-center gap-3 transition-all active:scale-95"
              >
                {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                Save All Health Information
              </Button>
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <Card>
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAcceptTerms} className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h3>
                  <div className="text-sm text-gray-600 space-y-3">
                    <p>By using Villahermosa Dental Clinic services, you agree to be bound by these Terms & Conditions.</p>
                    <p><strong>1. Services:</strong> We provide dental healthcare services including consultations, treatments, and follow-up care.</p>
                    <p><strong>2. Patient Responsibility:</strong> Patients are responsible for providing accurate personal and medical information.</p>
                    <p><strong>3. Confidentiality:</strong> All patient information is kept confidential in accordance with applicable laws and regulations.</p>
                    <p><strong>4. Payment:</strong> Payment must be made as agreed upon during consultation.</p>
                    <p><strong>5. Cancellation Policy:</strong> Appointments must be cancelled at least 24 hours in advance.</p>
                    <p><strong>6. Liability:</strong> We are not liable for any unforeseen complications unless caused by our negligence.</p>
                    <p><strong>7. Changes:</strong> We reserve the right to update these terms at any time.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="termsCheckbox" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    />
                    <Label htmlFor="termsCheckbox" className="text-sm cursor-pointer">
                      I have read and agree to the Terms & Conditions
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Patient Signature *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
                      <p className="text-xs text-gray-500 mb-2">Draw your signature below:</p>
                      <canvas
                        ref={setCanvasRef}
                        className="border border-gray-300 rounded w-full h-24 bg-white cursor-crosshair"
                        onMouseDown={(e) => {
                          const canvas = e.currentTarget as HTMLCanvasElement;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            const rect = canvas.getBoundingClientRect();
                            ctx.beginPath();
                            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                          }
                        }}
                        onMouseMove={(e) => {
                          if ((e as any).buttons !== 1) return;
                          const canvas = e.currentTarget as HTMLCanvasElement;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            const rect = canvas.getBoundingClientRect();
                            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                            ctx.stroke();
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => {
                          if (canvasRef) {
                            const ctx = canvasRef.getContext('2d');
                            ctx?.clearRect(0, 0, canvasRef.width, canvasRef.height);
                          }
                        }}
                      >
                        Clear Signature
                      </Button>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={!termsAccepted}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Accept Terms & Sign
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AccountPage;
