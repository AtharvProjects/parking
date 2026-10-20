package com.santwamanbhau.parking;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "WhatsAppDirectShare")
public class WhatsAppSharePlugin extends Plugin {

    @PluginMethod
    public void sharePdfToNumber(PluginCall call) {
        String phone = call.getString("phone");
        String filePath = call.getString("filePath");
        String text = call.getString("text");

        if (phone == null || phone.trim().isEmpty()) {
            call.reject("Driver phone number is required");
            return;
        }

        // Format phone: strip all non-digits, ensure 91 prefix for Indian 10-digit numbers
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        if (cleanPhone.length() == 10) {
            cleanPhone = "91" + cleanPhone;
        } else if (cleanPhone.length() == 11 && cleanPhone.startsWith("0")) {
            cleanPhone = "91" + cleanPhone.substring(1);
        }

        try {
            File file = new File(getContext().getCacheDir(), filePath);
            if (!file.exists()) {
                call.reject("PDF file not found in cache: " + filePath);
                return;
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("application/pdf");
            sendIntent.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) {
                sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            sendIntent.putExtra("jid", cleanPhone + "@s.whatsapp.net");
            sendIntent.setPackage("com.whatsapp");
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            sendIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                getContext().startActivity(sendIntent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                // If regular WhatsApp is not found, try WhatsApp Business (com.whatsapp.w4b)
                try {
                    sendIntent.setPackage("com.whatsapp.w4b");
                    getContext().startActivity(sendIntent);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception e2) {
                    // Fallback to chooser without package constraint
                    sendIntent.setPackage(null);
                    Intent chooser = Intent.createChooser(sendIntent, "Share PDF with " + cleanPhone);
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(chooser);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                }
            }
        } catch (Exception e) {
            call.reject("Error launching WhatsApp direct share: " + e.getMessage());
        }
    }
}
