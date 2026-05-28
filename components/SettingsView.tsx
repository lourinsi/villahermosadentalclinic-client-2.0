"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Clock,
  MapPin,
  Phone,
  Mail,
  Save
} from "lucide-react";
import { TIME_SLOTS, formatTimeTo12h } from "../lib/time-slots";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function SettingsView() {
  const [clinicName, setClinicName] = useState("Villahermosa Dental Clinic");
  const [email, setEmail] = useState("info@villahermosadental.com");
  const [phone, setPhone] = useState("+1 (555) 123-4567");
  const [address, setAddress] = useState("123 Main Street, City, State 12345");
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    desktop: true,
    appointments: true
  });

  // Profile image upload state
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (profileImage) {
        URL.revokeObjectURL(profileImage);
      }
    };
  }, [profileImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (profileImage) {
      URL.revokeObjectURL(profileImage);
    }
    const url = URL.createObjectURL(file);
    setProfileImage(url);
    setProfileFile(file);
  };

  const removeImage = () => {
    if (profileImage) {
      URL.revokeObjectURL(profileImage);
    }
    setProfileImage(null);
    setProfileFile(null);
  };

  return (
    <div data-tour-id="settings-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-muted-foreground">Manage your clinic settings and preferences</p>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-name">Clinic Name</Label>
                  <Input 
                    id="clinic-name" 
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operating Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="flex items-center justify-between">
                    <span className="w-24">{day}</span>
                    <div className="flex items-center space-x-2">
                      <Select defaultValue={TIME_SLOTS.indexOf("09:00").toString()}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot, index) => (
                            <SelectItem key={slot} value={index.toString()}>{formatTimeTo12h(slot)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>to</span>
                      <Select defaultValue={TIME_SLOTS.indexOf("17:00").toString()}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot, index) => (
                            <SelectItem key={slot} value={index.toString()}>{formatTimeTo12h(slot)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Switch defaultChecked={day !== 'Sunday'} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Administrator Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div>
                  <label htmlFor="profile-image-input" className="cursor-pointer block">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="h-24 w-24 rounded-full object-cover border" />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">Upload</div>
                    )}
                  </label>
                  <input
                    id="profile-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="mt-2">
                    {profileImage ? (
                      <Button variant="outline" onClick={removeImage}>Remove Photo</Button>
                    ) : (
                      <div className="text-sm text-muted-foreground">Click the avatar to upload</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-base font-medium">Profile Photo</div>
                  <div className="text-sm text-muted-foreground">Add or change your profile picture</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" defaultValue="Dr. John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" defaultValue="Villahermosa" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" defaultValue="Chief Dentist" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license">License Number</Label>
                <Input id="license" defaultValue="DDS-12345" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-base">Email Notifications</div>
                  <div className="text-sm text-muted-foreground">Receive notifications via email</div>
                </div>
                <Switch 
                  checked={notifications.email}
                  onCheckedChange={(checked: boolean) => setNotifications({...notifications, email: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-base">SMS Notifications</div>
                  <div className="text-sm text-muted-foreground">Receive notifications via SMS</div>
                </div>
                <Switch 
                  checked={notifications.sms}
                  onCheckedChange={(checked: boolean) => setNotifications({...notifications, sms: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-base">Desktop Notifications</div>
                  <div className="text-sm text-muted-foreground">Show desktop notifications</div>
                </div>
                <Switch 
                  checked={notifications.desktop}
                  onCheckedChange={(checked: boolean) => setNotifications({...notifications, desktop: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-base">Appointment Reminders</div>
                  <div className="text-sm text-muted-foreground">Send appointment reminders to patients</div>
                </div>
                <Switch 
                  checked={notifications.appointments}
                  onCheckedChange={(checked: boolean) => setNotifications({...notifications, appointments: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password & Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" />
              </div>
              <Button variant="outline">Change Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-base">Enable 2FA</div>
                  <div className="text-sm text-muted-foreground">Add an extra layer of security to your account</div>
                </div>
                <Badge variant="secondary">Not Enabled</Badge>
              </div>
              <Button variant="outline">Set up 2FA</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme & Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Button variant="outline" className="h-20 flex-col">
                    <div className="w-4 h-4 bg-white border rounded mb-2"></div>
                    Light
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <div className="w-4 h-4 bg-gray-800 rounded mb-2"></div>
                    Dark
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <div className="w-4 h-4 bg-gradient-to-r from-white to-gray-800 rounded mb-2"></div>
                    Auto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Language & Region</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input id="language" defaultValue="English (US)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" defaultValue="UTC-5 (Eastern Time)" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
