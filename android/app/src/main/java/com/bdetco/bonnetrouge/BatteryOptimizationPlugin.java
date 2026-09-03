package com.bdetco.bonnetrouge;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Exemption d'optimisation batterie : indispensable pour que le service de
 * tournée survive sur les OEM agressifs (HiOS/XOS, MIUI…). L'intent direct
 * ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS est autorisé car l'APK est
 * distribué hors Play Store.
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = pm != null
                && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());

        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }
}
