package com.bdco.bonnetrouge;

import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Présence du matériel de localisation. Les tablettes Samsung Galaxy Tab A en
 * version Wi-Fi n'embarquent pas de puce GPS : aucune permission ni aucun
 * réglage ne peut y produire une position satellitaire. L'app doit le savoir
 * pour dégrader (visite enregistrable sans position, géorepérage ignoré) au
 * lieu d'échouer avec « Activez la localisation », conseil inapplicable.
 *
 * `network` reste vrai sur ces tablettes (localisation Wi-Fi via les services
 * Google) mais sa précision, de l'ordre de la dizaine à la centaine de mètres,
 * ne satisfait jamais le seuil de géorepérage : c'est `gps` qui décide.
 */
@CapacitorPlugin(name = "DeviceLocation")
public class DeviceLocationPlugin extends Plugin {

    @PluginMethod
    public void hasLocationHardware(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        boolean gps = pm.hasSystemFeature(PackageManager.FEATURE_LOCATION_GPS);
        boolean network = pm.hasSystemFeature(PackageManager.FEATURE_LOCATION_NETWORK);

        JSObject ret = new JSObject();
        ret.put("gps", gps);
        ret.put("network", network);
        ret.put("any", gps || network);
        call.resolve(ret);
    }
}
