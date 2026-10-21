package de.familyprojekt.workflowpdf.pro;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.os.storage.*;
import android.text.InputType;
import android.util.Base64;
import android.view.View;
import android.widget.*;
import androidx.activity.result.ActivityResult;
import androidx.appcompat.app.AlertDialog;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** Passwords are entered in an Android dialog and never cross the JavaScript bridge. */
@CapacitorPlugin(name="WorkflowVault")
public final class ProVaultPlugin extends Plugin {
    private final PluginWorker worker=new PluginWorker("vault");
    private final AtomicBoolean choosing=new AtomicBoolean();
    private VaultLocations locations;
    @Override public void load(){worker.execute(()->locations=new VaultLocations(getContext()));}
    private DocumentVault vault(PluginCall call)throws Exception{return locations.get(call.getString("location"));}
    private interface Work{JSONObject run()throws Exception;}
    private static String code(Exception error){
        String message=error.getMessage();
        if(message!=null&&message.matches("VAULT_[A-Z_]+"))return message;
        return error instanceof JSONException?"VAULT_DAMAGED":error instanceof SecurityException||error instanceof java.io.FileNotFoundException?"VAULT_FOLDER_UNAVAILABLE":"VAULT_UNAVAILABLE";
    }
    private void work(PluginCall call,Work task){worker.submit(call,()->{try{call.resolve(JSObject.fromJSONObject(task.run()));}catch(Exception error){String code=code(error);call.reject(code,code);}});}
    @PluginMethod public void state(PluginCall call){work(call,()->locations.state(call.getString("location")));}
    @PluginMethod public void locations(PluginCall call){work(call,()->new JSONObject().put("items",locations.list()));}
    @PluginMethod public void migration(PluginCall call){work(call,()->new JSONObject().put("location",locations.migration()==null?JSONObject.NULL:locations.migration()));}
    @PluginMethod public void prepareMigration(PluginCall call){work(call,()->{locations.prepareMigration(call.getString("location"));return new JSONObject().put("saved",true);});}
    @PluginMethod public void completeMigration(PluginCall call){work(call,()->{locations.completeMigration(call.getString("location"));return locations.state(null);});}
    @PluginMethod public void cancelMigration(PluginCall call){work(call,()->{locations.cancelMigration();return new JSONObject().put("saved",true);});}
    @PluginMethod public void beginBatch(PluginCall call){work(call,()->{vault(call).beginBatch();return new JSONObject().put("started",true);});}
    @PluginMethod public void commitBatch(PluginCall call){work(call,()->{vault(call).commitBatch();return new JSONObject().put("saved",true);});}
    @PluginMethod public void abortBatch(PluginCall call){work(call,()->{vault(call).abortBatch();return new JSONObject().put("aborted",true);});}
    @PluginMethod public void setPrimary(PluginCall call){work(call,()->{locations.select(call.getString("location"));return locations.state(null);});}
    @PluginMethod public void volumes(PluginCall call){work(call,()->{
        JSONArray out=new JSONArray();StorageManager storage=(StorageManager)getContext().getSystemService(Context.STORAGE_SERVICE);
        if(storage!=null)for(StorageVolume volume:storage.getStorageVolumes())if(android.os.Environment.MEDIA_MOUNTED.equals(volume.getState()))
            out.put(new JSONObject().put("id",volume.isPrimary()?"primary":String.valueOf(volume.getUuid())).put("primary",volume.isPrimary()).put("removable",volume.isRemovable()).put("label",volume.getDescription(getContext())));
        return new JSONObject().put("items",out);
    });}
    @PluginMethod public void choose(PluginCall call){
        if(worker.closed()){call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        if(!choosing.compareAndSet(false,true)){call.reject("VAULT_BUSY","VAULT_BUSY");return;}
        Intent intent=null;String selected=call.getString("volume","");
        if(Build.VERSION.SDK_INT>=29&&!selected.isEmpty()){
            StorageManager storage=(StorageManager)getContext().getSystemService(Context.STORAGE_SERVICE);
            if(storage!=null)for(StorageVolume v:storage.getStorageVolumes())if(selected.equals(v.isPrimary()?"primary":String.valueOf(v.getUuid())))intent=v.createOpenDocumentTreeIntent();
        }
        if(intent==null)intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try{startActivityForResult(call,intent,"folderChosen");}
        catch(Exception error){choosing.set(false);call.reject("VAULT_FOLDER_UNAVAILABLE","VAULT_FOLDER_UNAVAILABLE");}
    }
    @ActivityCallback private void folderChosen(PluginCall call,ActivityResult result){
        if(call==null){choosing.set(false);return;}
        Intent data=result.getData();
        if(result.getResultCode()!=Activity.RESULT_OK||data==null||data.getData()==null){choosing.set(false);call.resolve(new JSObject().put("cancelled",true));return;}
        Uri tree=data.getData();int flags=Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        worker.submit(call,()->{
            try{
                if(!"content".equals(tree.getScheme())||(data.getFlags()&flags)!=flags)throw new SecurityException();
                getContext().getContentResolver().takePersistableUriPermission(tree,flags);
                locations.ensureIdle();
                DocumentVault candidate=locations.candidate();DocumentVault.Place place=candidate.inspect(tree);boolean exists=candidate.existing(place);
                if(call.getString("expectedVaultId")!=null&&!exists)throw new java.io.IOException("VAULT_WRONG_FOLDER");
                getActivity().runOnUiThread(()->password(call,candidate,place,exists?1:0));
            }catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    @PluginMethod public void unlock(PluginCall call){
        if(!choosing.compareAndSet(false,true)){call.reject("VAULT_BUSY","VAULT_BUSY");return;}
        worker.submit(call,()->{
            try{DocumentVault selected=vault(call);getActivity().runOnUiThread(()->password(call,selected,null,2));}
            catch(Exception error){choosing.set(false);String code=code(error);call.reject(code,code);}
        });
    }
    private static final String[][] WORDS={
        {"Dokumenttresor einrichten","Create document vault","Создать хранилище документов","إنشاء خزنة المستندات"},
        {"Dokumenttresor öffnen","Open document vault","Открыть хранилище документов","فتح خزنة المستندات"},
        {"Passwort","Password","Пароль","كلمة المرور"},
        {"Passwort wiederholen","Repeat password","Повторить пароль","تأكيد كلمة المرور"},
        {"Passwort vergessen = Daten verloren. Ich bewahre es sicher auf.","Forgotten password = lost data. I will keep it safe.","Забытый пароль = потерянные данные. Я сохраню его надёжно.","نسيان كلمة المرور يعني فقدان البيانات. سأحتفظ بها بأمان."},
        {"Auf diesem Gerät entsperrt halten","Keep unlocked on this device","Оставить разблокированным на этом устройстве","الإبقاء على الخزنة مفتوحة على هذا الجهاز"},
        {"Abbrechen","Cancel","Отмена","إلغاء"},
        {"Weiter","Continue","Продолжить","متابعة"},
        {"Mindestens 10 Zeichen; beide Passwörter müssen übereinstimmen. Hinweis bestätigen.","Use at least 10 matching characters and confirm the notice.","Не менее 10 символов; пароли должны совпадать. Подтвердите предупреждение.","استخدم 10 أحرف على الأقل، وطابق كلمتي المرور وأكّد التنبيه."},
        {"Passwort falsch oder Speicherort nicht erreichbar. Keine Daten wurden zurückgesetzt.","Wrong password or storage unavailable. No data was reset.","Неверный пароль или хранилище недоступно. Данные не сброшены.","كلمة المرور غير صحيحة أو التخزين غير متاح. لم تتم إعادة تعيين البيانات."}
    };
    private void password(PluginCall call,DocumentVault vault,DocumentVault.Place place,int mode){
        if(worker.closed()||getActivity().isFinishing()||getActivity().isDestroyed()){choosing.set(false);call.reject("NATIVE_ACTIVITY_CLOSED");return;}
        String language=call.getString("language","de");int index=Arrays.asList("de","en","ru","ar").indexOf(language);final int lang=index<0?0:index;
        java.util.function.IntFunction<String> t=n->WORDS[n][lang];
        LinearLayout box=new LinearLayout(getContext());box.setOrientation(LinearLayout.VERTICAL);int pad=(int)(20*getContext().getResources().getDisplayMetrics().density);box.setPadding(pad,pad,pad,pad);
        if(lang==3)box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        EditText first=new EditText(getContext()),second=new EditText(getContext());
        for(EditText field:new EditText[]{first,second}){field.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);if(Build.VERSION.SDK_INT>=26)field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);}
        first.setHint(t.apply(2));second.setHint(t.apply(3));box.addView(first);if(mode==0)box.addView(second);
        CheckBox notice=new CheckBox(getContext());notice.setText(t.apply(4));if(mode==0)box.addView(notice);
        CheckBox remember=new CheckBox(getContext());remember.setText(t.apply(5));remember.setChecked(true);box.addView(remember);
        TextView status=new TextView(getContext());box.addView(status);ScrollView scroll=new ScrollView(getContext());scroll.addView(box);
        AlertDialog dialog=new AlertDialog.Builder(getActivity()).setTitle(t.apply(mode==0?0:1)).setView(scroll)
            .setNegativeButton(t.apply(6),(d,w)->{choosing.set(false);first.getText().clear();second.getText().clear();call.resolve(new JSObject().put("cancelled",true));})
            .setPositiveButton(t.apply(7),null).create();
        dialog.setOnCancelListener(d->{choosing.set(false);first.getText().clear();second.getText().clear();call.resolve(new JSObject().put("cancelled",true));});
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String p=java.text.Normalizer.normalize(first.getText(),java.text.Normalizer.Form.NFC);
            if(mode==0&&(p.codePointCount(0,p.length())<10||!p.equals(java.text.Normalizer.normalize(second.getText(),java.text.Normalizer.Form.NFC))||!notice.isChecked())){status.setText(t.apply(8));return;}
            boolean keep=remember.isChecked();dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
            worker.submit(call,()->{
                try{
                    if(mode==0)vault.initialize(place,p,keep);else if(mode==1)vault.open(place,p,keep);else vault.unlock(p,keep);
                    String expected=call.getString("expectedVaultId");
                    if(expected!=null&&!expected.equals(vault.identity())){vault.lock();throw new java.io.IOException("VAULT_WRONG_FOLDER");}
                    String location=mode==2?vault.locationId():locations.adopt(vault);
                    JSONObject state=locations.state(location);getActivity().runOnUiThread(()->{first.getText().clear();second.getText().clear();dialog.dismiss();choosing.set(false);call.resolve(new JSObject().put("location",location).put("state",state).put("created",mode==0).put("opened",mode==1).put("unlocked",true));});
                }catch(Exception error){getActivity().runOnUiThread(()->{first.getText().clear();second.getText().clear();status.setText(t.apply(9));dialog.setCancelable(true);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);});}
            });
        }));dialog.show();first.requestFocus();
    }
    @PluginMethod public void lock(PluginCall call){work(call,()->{locations.lock();return locations.state(null);});}
    @PluginMethod public void begin(PluginCall call){work(call,()->new JSONObject().put("ticket",vault(call).begin(call.getString("store"),call.getString("id"),call.getData().optJSONObject("reference"))));}
    @PluginMethod public void append(PluginCall call){work(call,()->{
        String data=call.getString("data","");if(data.length()>349528)throw new java.io.IOException("VAULT_INVALID_TRANSFER");
        vault(call).append(call.getString("ticket"),ProFilesPlugin.integer(call.getData().opt("offset")),Base64.decode(data,Base64.NO_WRAP));return new JSONObject().put("ok",true);
    });}
    @PluginMethod public void finish(PluginCall call){work(call,()->{DocumentVault v=vault(call);v.finish(call.getString("ticket"),ProFilesPlugin.integer(call.getData().opt("size")));return v.info(call.getString("store"),call.getString("id")).put("saved",true);});}
    @PluginMethod public void abort(PluginCall call){work(call,()->{vault(call).abort(call.getString("ticket"));return new JSONObject();});}
    @PluginMethod public void info(PluginCall call){work(call,()->vault(call).info(call.getString("store"),call.getString("id")));}
    @PluginMethod public void read(PluginCall call){work(call,()->new JSONObject().put("data",Base64.encodeToString(vault(call).read(call.getString("store"),call.getString("id"),ProFilesPlugin.integer(call.getData().opt("offset")),call.getString("hash")),Base64.NO_WRAP)));}
    @PluginMethod public void list(PluginCall call){work(call,()->new JSONObject().put("ids",vault(call).list(call.getString("store"))));}
    @PluginMethod public void remove(PluginCall call){work(call,()->{vault(call).remove(call.getString("store"),call.getString("id"),call.getBoolean("prefix",false));return new JSONObject().put("saved",true);});}
    @Override protected void handleOnDestroy(){worker.close(()->locations.close());}
}
