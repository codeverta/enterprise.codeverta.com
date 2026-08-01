import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MapPin, Shirt, Calendar, Globe } from 'lucide-react';

const ParticipantDashboard = ({data}: {

}) => {

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const StatCard = ({ title, value, icon: Icon, description }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs mt-2 text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );

  const BreakdownCard = ({ title, data, icon: Icon }) => {
    const safeData = data || {}; 

    return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Cek length dari safeData, bukan data */}
          {
            Object.keys(safeData).length === 0 && <p className="text-sm text-muted-foreground">No data available.</p>
          }
          {/* Lakukan mapping pada safeData */}
          {Object.entries(safeData).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium">{key}</span>
              <span className="text-sm text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )};

  return (
    <div className="">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Ringkasan Data Peserta</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Last updated: {formatDate(data.daily_stats[data.daily_stats.length - 1]?.updated_at)}
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Participants"
            value={data.summary.total_participants}
            icon={Users}
            description="Registered participants"
          />
          <StatCard
            title="Categories"
            value={Object.keys(data.summary.by_category).length}
            icon={Calendar}
            description="Event categories"
          />
          <StatCard
            title="Provinces"
            value={Object.keys(data.summary.by_province).length}
            icon={MapPin}
            description="Different locations"
          />
          <StatCard
            title="Jersey Sizes"
            value={Object.keys(data.summary.by_jersey_size).length}
            icon={Shirt}
            description="Size variations"
          />
        </div>

        {/* Detailed Breakdowns */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <BreakdownCard
            title="Gender Distribution"
            data={data.summary.by_gender}
            icon={Users}
          />
          <BreakdownCard
            title="Age Groups"
            data={data.summary.by_age_group}
            icon={Calendar}
          />
          <BreakdownCard
            title="Categories"
            data={data.summary.by_category}
            icon={MapPin}
          />
          <BreakdownCard
            title="Jersey Sizes"
            data={data.summary.by_jersey_size}
            icon={Shirt}
          />
          <BreakdownCard
            title="Province Distribution"
            data={data.summary.by_province}
            icon={MapPin}
          />
          <BreakdownCard
            title="Country Distribution"
            data={data.summary.by_country} // Sesuaikan path object JSON barunya
            icon={Globe}
          />
        </div>

        {/* Daily Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Statistics</CardTitle>
            <CardDescription>Registration activity by date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {
                data.daily_stats.length === 0 && <p className="text-sm text-muted-foreground">No daily statistics available.</p>
              }
              {data.daily_stats.map((stat, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{formatDate(stat.date)}</h3>
                    <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                      {stat.total_participants} participants
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div>Gender: {stat?.gender_breakdown && Object.keys(stat.gender_breakdown).join(', ')}</div>
                    <div>Age: {stat?.age_group_breakdown && Object.keys(stat.age_group_breakdown).join(', ')}</div>
                    <div>Category: {stat?.category_breakdown && Object.keys(stat.category_breakdown).join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantDashboard;