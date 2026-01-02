import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, RefreshCw, Database, Link2, AlertCircle } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabase';
import { toast } from 'sonner';

export function GHLConnection({ userEmail, onConnectionChange }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [formData, setFormData] = useState({
    apiKey: '',
    locationId: '',
    agencyId: '',
  });

  useEffect(() => {
    fetchStatus();
  }, [userEmail]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await callEdgeFunction('ghlCredentials/status', {}, {
        method: 'GET',
        params: { userEmail: userEmail || 'demo@example.com' }
      });

      if (response.success) {
        setStatus(response.status);
        onConnectionChange?.(response.connected);
      }
    } catch (error) {
      console.error('Error fetching GHL status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!formData.apiKey || !formData.locationId) {
      toast.error('API Key and Location ID are required');
      return;
    }

    setLoading(true);
    try {
      const response = await callEdgeFunction('ghlCredentials/save', {
        userEmail: userEmail || 'demo@example.com',
        apiKey: formData.apiKey,
        locationId: formData.locationId,
        agencyId: formData.agencyId || null,
      });

      if (response.success) {
        toast.success('GHL connected successfully!');
        setShowConnectModal(false);
        setFormData({ apiKey: '', locationId: '', agencyId: '' });
        fetchStatus();
      } else {
        toast.error(response.error || 'Failed to connect GHL');
      }
    } catch (error) {
      console.error('Error connecting GHL:', error);
      toast.error(error.message || 'Failed to connect GHL');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect GoHighLevel? This will not delete your synced data.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await callEdgeFunction('ghlCredentials/disconnect', {
        userEmail: userEmail || 'demo@example.com',
      });

      if (response.success) {
        toast.success('GHL disconnected');
        fetchStatus();
      }
    } catch (error) {
      console.error('Error disconnecting GHL:', error);
      toast.error('Failed to disconnect GHL');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPipelines = async () => {
    setSyncing(true);
    try {
      const response = await callEdgeFunction('ghlSyncPipelines', {
        userEmail: userEmail || 'demo@example.com',
      });

      if (response.success) {
        toast.success(`Synced ${response.stats.total} pipelines!`);
        fetchStatus();
      } else {
        toast.error(response.error || 'Failed to sync pipelines');
      }
    } catch (error) {
      console.error('Error syncing pipelines:', error);
      toast.error(error.message || 'Failed to sync pipelines');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncContacts = async () => {
    setSyncing(true);
    try {
      const response = await callEdgeFunction('ghlSyncContacts', {
        userEmail: userEmail || 'demo@example.com',
        limit: 100,
      });

      if (response.success) {
        toast.success(`Synced ${response.stats.imported + response.stats.updated} contacts!`);
        fetchStatus();
      } else {
        toast.error(response.error || 'Failed to sync contacts');
      }
    } catch (error) {
      console.error('Error syncing contacts:', error);
      toast.error(error.message || 'Failed to sync contacts');
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.is_active;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                GoHighLevel Integration
              </CardTitle>
              <CardDescription>
                Connect your GHL account to sync pipelines and contacts
              </CardDescription>
            </div>
            {isConnected ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect your GoHighLevel account to import pipelines and contacts for dialing.
                </AlertDescription>
              </Alert>
              <Button onClick={() => setShowConnectModal(true)} className="w-full">
                Connect GoHighLevel
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="text-2xl font-bold">{status?.pipeline_count || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Pipelines</div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="text-2xl font-bold">{status?.lead_count || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Contacts</div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {status?.last_synced_at
                      ? `Synced ${new Date(status.last_synced_at).toLocaleDateString()}`
                      : 'Never synced'
                    }
                  </div>
                </div>
              </div>

              {status?.sync_error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{status.sync_error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSyncPipelines}
                  disabled={syncing || loading}
                  variant="outline"
                  className="flex-1"
                >
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Sync Pipelines
                </Button>
                <Button
                  onClick={handleSyncContacts}
                  disabled={syncing || loading}
                  variant="outline"
                  className="flex-1"
                >
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Sync Contacts
                </Button>
              </div>

              <Button
                onClick={handleDisconnect}
                disabled={loading}
                variant="outline"
                className="w-full text-red-600 hover:text-red-700"
              >
                Disconnect
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GoHighLevel</DialogTitle>
            <DialogDescription>
              Enter your GHL API credentials to sync your pipelines and contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your GHL API key"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Find this in your GHL Settings → API Keys
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationId">Location ID *</Label>
              <Input
                id="locationId"
                placeholder="Enter your GHL location ID"
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Find this in your GHL Settings → Business Profile
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agencyId">Agency ID (Optional)</Label>
              <Input
                id="agencyId"
                placeholder="Enter your GHL agency ID"
                value={formData.agencyId}
                onChange={(e) => setFormData({ ...formData, agencyId: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowConnectModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={loading || !formData.apiKey || !formData.locationId}
                className="flex-1"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
